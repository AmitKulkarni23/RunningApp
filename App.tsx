import React, { useState, useRef } from 'react';
import { Button, View, Alert, Text, StyleSheet } from 'react-native';
import { check, PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import Geolocation from '@react-native-community/geolocation';
import haversine from 'haversine';
import Tts from 'react-native-tts';

enum RacePhase {
  RUN,
  WALK,
}

const App = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [distance, setDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<{ latitude: number, longitude: number } | null>(null);
  const [racePhase, setRacePhase] = useState<RacePhase>(RacePhase.RUN);
  const [mileTime, setMileTime] = useState<number | null>(null);
  const lastMileMarker = useRef<number>(0);

  const requestLocationPermission = async () => {
    const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    return result === RESULTS.GRANTED;
  };

  const handlePress = async () => {
    if (!isRunning) {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission required', 'Location permission is required to start the race');
        return;
      }

      setStartTime(new Date());

      watchId.current = Geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newDistance = lastPosition.current
            ? haversine(lastPosition.current, { latitude, longitude })
            : 0;
          setDistance((prevDistance) => prevDistance + newDistance);
          lastPosition.current = { latitude, longitude };

          // Update elapsed time
          if (startTime) {
            const currentTime = new Date();
            const timeDiff = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
            setElapsedTime(timeDiff);
          }

          // Speak every mile
          if (Math.floor(distance) - Math.floor(distance - newDistance) > 0) {
            if (mileTime) {
              Tts.speak(`Mile ${Math.floor(distance)} completed in ${elapsedTime - mileTime} seconds. Total time is ${elapsedTime} seconds.`);
              setMileTime(elapsedTime);
              setRacePhase(RacePhase.WALK);
              lastMileMarker.current = Math.floor(distance);
            } else {
              setMileTime(elapsedTime);
            }
          }

          // Transition back to running after walking 0.1 mile
          if (racePhase === RacePhase.WALK && distance - lastMileMarker.current >= 0.1) {
            Tts.speak('You have walked for 0.1 miles; Time to run for 1 more mile');
            setRacePhase(RacePhase.RUN);
          }
        },
        (error) => {
          console.log(error.code, error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, distanceFilter: 50 }
      );
    } else {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
      // Reset start time and elapsed time when stop button is pressed
      setStartTime(null);
      setElapsedTime(0);
    }

    setIsRunning(!isRunning);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{`Distance: ${distance.toFixed(2)} miles`}</Text>
      <Text style={styles.text}>{`Time: ${elapsedTime} seconds`}</Text>
      <Button onPress={handlePress} title={isRunning ? 'Stop' : 'Start'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});

export default App;
