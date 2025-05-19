/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import RNFS from 'react-native-fs';

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
//import KeyWordRNBridge from "./rnkeywordspotter/KeyWordRNBridge";
import useModel from 'react-native-wakeword';
interface instanceConfig {
  id: string;
  modelName: string;
  threshold: number;
  bufferCnt: number;
  sticky: boolean;
}
// Create an array of instance configurations
const instanceConfigs:instanceConfig[] = [
  { id: 'need_help_now', modelName: 'need_help_now.onnx', threshold: 0.9999, bufferCnt: 3 , sticky: false },
  { id: 'default', modelName: "", threshold: 0.9999, bufferCnt: 2 , sticky: false }
];

//import RNFS from 'react-native-fs';

import { NativeModules } from 'react-native';
import { AppState } from 'react-native';


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
    // Bug FOREGROUND_SERVICE does not exist
    const foregroundServicePermission = await request('android.permission.FOREGROUND_SERVICE');
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

type DetectionCallback = (event: any) => void;


function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFlashing, setIsFlashing] = useState(false);
  const wakeWordFile = instanceConfigs[0].modelName;
  const wakeWord = formatWakeWord(wakeWordFile);
  console.log("useModel == ", useModel)
  const { stopListening, startListening, loadModel, setKeywordDetectionLicense} = useModel();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  // State to handle the display message
  const [message, setMessage] = useState(`Listening to WakeWord '${wakeWord}'...`);

  useEffect(() => {

    const keywordCallback = async (keywordIndex: any) => {
      //await stopListening();
      console.log ("detected keyword: ", keywordIndex);
      setMessage(`WakeWord '${keywordIndex}' DETECTED`);
      setIsFlashing(true);  // Start flashing effect (Line 122)

      const timeout = setTimeout(() => {
        console.log('5 seconds have passed!');
        setMessage(`Listening to WakeWord '${wakeWord}'...`);
        setIsFlashing(false);  // Start flashing effect (Line 122)
        // Perform your action here
      }, 5000);
    }
    // Create an array of instance configurations
    const instanceConfigs:instanceConfig[] = [
      { id: 'need_help_now', modelName: 'need_help_now.onnx', threshold: 0.9999, bufferCnt: 3 , sticky: false },
    ];

    const initializeKeywordDetection = async () => {
      try {
        // Wait for audio permission to be granted
        await AudioPermissionComponent();
        await setKeywordDetectionLicense(
          "MTczNDIxMzYwMDAwMA==-tNV5HJ3NTRQCs5IpOe0imza+2PgPCJLRdzBJmMoJvok=");
          
        await loadModel(instanceConfigs, keywordCallback);
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

