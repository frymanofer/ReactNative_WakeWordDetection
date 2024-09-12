/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';

import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import type {PropsWithChildren} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Platform,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

import LinearGradient from 'react-native-linear-gradient';

//import { useModel } from "./useModel";
//const { loadModel, startListening, stopListening } = useModel();

const detectionCallback = async (keywordIndex: any) => {
  console.log("detectionCallback detectionCallback detectionCallback!!!!!!!!!!!!!!!!!!");
  KeyWordRNBridge?.stopKeywordDetection();
};

/*
const AudioPermissionComponent = async () => {
  const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
  await request(permission);
  const status = await check(permission);
  if (status !== RESULTS.GRANTED) {
      await request(permission);
  }
}
*/

// Helper function to format the ONNX file name
const formatWakeWord = (fileName) => {
  return fileName
    .replace(/_/g, ' ')  // Use global flag to replace all underscores
    .replace('.onnx', '')
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize each word
};

const AudioPermissionComponent = async () => {
  const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
  await request(permission);
  const status = await check(permission);
  if (status !== RESULTS.GRANTED) {
      await request(permission);
  }
  if (Platform.OS === 'ios' )
  {

  }
  else {
    const foregroundServicePermission = await request(PERMISSIONS.ANDROID.FOREGROUND_SERVICE);
    if (foregroundServicePermission === RESULTS.GRANTED) {
      console.log("Permissions granted", "Microphone and foreground service permissions granted.");
        // Start your service or perform other actions
    } else {
      console.log("Permission denied", "Foreground service microphone permission is required.");
    }
  }
}


type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({children, title}: SectionProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

import KeyWordRNBridge from "./rnkeywordspotter/KeyWordRNBridge";
type DetectionCallback = (event: any) => void;


function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFlashing, setIsFlashing] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const wakeWord = formatWakeWord(wakeWordFile);
  // State to handle the display message
  const [message, setMessage] = useState(`Listening to WakeWord '${wakeWord}'...`);

  useEffect(() => {
    const initializeKeywordDetection = async () => {
      try {
        // Wait for audio permission to be granted
        await AudioPermissionComponent();

        // Initialize keyword detection after permission is granted
        KeyWordRNBridge.initKeywordDetection(wakeWordFile, 0.9999, 2);
        await KeyWordRNBridge.setKeywordDetectionLicense(
          "MTcyODkzOTYwMDAwMA==-XPLwWg6m4aFC9YMJZu0d0rKIh2AsExYixyeCpiVQmpE=",
      );
      KeyWordRNBridge.onKeywordDetectionEvent((event) => {
        console.log("KeywordDetection event detected:", event);
          
        // Change the message to detected
        setMessage(`WakeWord '${wakeWord}' detected`);

        setIsFlashing(true);  // Start flashing effect (Line 122)

        // Revert back to the listening message after 10 seconds
        setTimeout(() => {
          setMessage(`Listening to WakeWord '${wakeWord}'...`);
          setIsFlashing(false);  // Stop flashing effect (Line 126)
//          KeyWordRNBridge.stopKeywordDetection();
//          KeyWordRNBridge.startKeywordDetection();    
        }, 5000); // 5 seconds delay

        detectionCallback(event);
     });
      KeyWordRNBridge.stopKeywordDetection();
      KeyWordRNBridge.startKeywordDetection();

      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };

    initializeKeywordDetection();  // Call the async function inside useEffect
    // Call your native bridge function
  //KeyWordRNBridge.initKeywordDetection("bla", 0.9999, 2);
  //loadModel();
}, []);  // Empty dependency array ensures it runs once when the component mounts


return (
  <LinearGradient
    colors={isDarkMode ? ['#232526', '#414345'] : ['#e0eafc', '#cfdef3']}
    style={styles.linearGradient}>
    <StatusBar
      barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      backgroundColor={backgroundStyle.backgroundColor}
    />
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={backgroundStyle}>
      <View 
      style={[styles.container, 
      { backgroundColor: 
        isFlashing ? (isDarkMode ? '#ff4d4d' : '#ffcccc') : isDarkMode ? Colors.black : Colors.white }]}>
        <Text style={styles.title}>{message}</Text>
      </View>
    </ScrollView>
    </LinearGradient>
);
}

const styles = StyleSheet.create({
container: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 16,
  marginTop: 32,
},
linearGradient: {
  flex: 1,
},
title: {
  fontSize: 28,
  fontWeight: 'bold',
  color: '#4a4a4a',
  textAlign: 'center',
  paddingHorizontal: 20,
  backgroundColor: '#ffffff99',
  borderRadius: 12,
  paddingVertical: 20,
  marginHorizontal: 10,
  elevation: 4, // Android shadow
  shadowColor: '#000', // iOS shadow
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
},
});

export default App;

