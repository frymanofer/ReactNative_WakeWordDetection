import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { AppState } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import { Platform } from 'react-native';
import {name as appName} from './app.json';

/*
const startForegroundService = () => {
  if (Platform.OS === 'ios' )
    return;
  const { NativeModules } = require('react-native');
  const { ForegroundModule } = NativeModules;
  ForegroundModule.startMicrophoneService();
};

startForegroundService();
*/

// Ensure the environment is set up appropriately whether you load the app in Expo Go or in a native build
AppRegistry.registerComponent(appName, () => App);

/*
  // Background Fetch setup for iOS
const configureBackgroundFetch = () => {
  if (Platform.OS === 'ios') {

    BackgroundFetch.configure({
        minimumFetchInterval: 15, // Fetch interval in minutes
        stopOnTerminate: false, // Continue fetch events even after the app is terminated
        startOnBoot: true, // Start fetch events when the device is restarted
        enableHeadless: true, // Enable headless mode
    }, async (taskId) => {
        console.log('[BackgroundFetch] taskId:', taskId);
        const remoteMessage = await messaging().getInitialNotification();
        if (remoteMessage) {
            await handleRcvMessage(remoteMessage);
        }
        BackgroundFetch.finish(taskId);
    }, (error) => {
        console.log('[BackgroundFetch] failed to start:', error);
    });

    BackgroundFetch.start();
  }
};

// configureBackgroundFetch();
*/

