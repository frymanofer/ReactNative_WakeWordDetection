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
import KeyWordRNBridge from "./rnkeywordspotter/KeyWordRNBridge";
//import RNFS from 'react-native-fs';

import { NativeModules } from 'react-native';
import { AppState } from 'react-native';

const { ForegroundServiceModule } = NativeModules;

function bringAppToForeground() {
  if (Platform.OS === 'ios')
    return;
  console.log("ForegroundServiceModule == ", ForegroundServiceModule);
  // Call the native module method to bring the app to the foreground
  ForegroundServiceModule.bringAppToForeground()
    .then(() => {
      console.log('Called bringing app to foreground');
    })
    .catch((error) => {
      console.error('Error bringing app to foreground:', error);
    });
}

// Call this function when your callback is triggered


//import { useModel } from "./useModel";
//const { loadModel, startListening, stopListening } = useModel();

import Sound from 'react-native-sound';

// Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

const playSoundFile = (fileName) => {
  try {
    // Initialize the sound object with the file path
    const sound = new Sound(fileName, '', (error) => {
      if (error) {
        console.error('Failed to load the sound', error);
        return;
      }

      // Get the duration of the audio file in seconds
      const duration = sound.getDuration();

      // Calculate the start time (last three seconds)
      const startTime = Math.max(0, duration - 3);

      // Seek to the start time
      sound.setCurrentTime(startTime);

      // Play the sound
      sound.play((success) => {
        if (success) {
          console.log('Successfully played the sound');
        } else {
          console.error('Playback failed due to audio decoding errors');
        }

        // Release the sound when done
        sound.release();
      });
    });
  } catch (error) {
    console.error('Error playing sound file:', error);
  }
};

/*
const playAudio = (filePath) => {
  const sound = new Sound(filePath, Sound.DOCUMENT, (error) => {
    if (error) {
      console.log('Failed to load the sound', error);
      return;
    }
    // Play the sound
    sound.play((success) => {
      if (success) {
        console.log('Successfully finished playing');
      } else {
        console.log('Playback failed due to audio decoding errors');
      }
    });
  });
};
*/

// Call playAudio with the path to your wav file
//playAudio('/data/user/0/com.exampleapp/files/need_help_now_prediction.wav');

const playAllSoundFile = async (fileName) => {
  try {
    playAudio(fileName);
    console.log('File :', fileName);
  } catch (error) {
    console.error('Error moving file:', error);
  }
};

const detectionCallback = async (keywordIndex: any) => {
  bringAppToForeground();
  console.log("detectionCallback detectionCallback detectionCallback!!!!!!!!!!!!!!!!!!");
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
  const wakeWordFile = "need_help_now.onnx";
  const wakeWord = formatWakeWord(wakeWordFile);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  // State to handle the display message
  const [message, setMessage] = useState(`Listening to WakeWord '${wakeWord}'...`);

  useEffect(() => {
    const initializeKeywordDetection = async () => {
      try {
        // Wait for audio permission to be granted
        await AudioPermissionComponent();

        // Initialize keyword detection after permission is granted
        KeyWordRNBridge.initKeywordDetection(wakeWordFile, 0.9999, 2);
        var isLicensed = await KeyWordRNBridge.setKeywordDetectionLicense(
          "MTczMjkxNzYwMDAwMA==-DDwBWs914KpHbWBBSqi28vhiM4l5CYG+YgS2n9Z3DMI=");
        if (!isLicensed) {
          setMessage(`No license - please contact ofer@davoice.io`);
          return;
        }

        const eventListener = KeyWordRNBridge.onKeywordDetectionEvent((event) => {         
          // Stop listening.
          KeyWordRNBridge.stopKeywordDetection();
          console.log("KeywordDetection event detected:", event);
          // Change the message to detected
          setMessage(`WakeWord '${wakeWord}' DETECTED`);

          setIsFlashing(true);  // Start flashing effect (Line 122)

          if (!AppState.currentState.match(/foreground/)) {
            setTimeout(() => {
              (async () => {
                  KeyWordRNBridge.stopKeywordDetection();
                  setMessage(`Paying back '${wakeWord}' which activated the App`);
                  const wavFilePath = await KeyWordRNBridge.gerRecordingWav();
                  console.log("wavFilePath == ",wavFilePath);
                  if (!wavFilePath)
                    return;
                  const cleanedFilePath = wavFilePath.startsWith('file://') ? wavFilePath.slice(7) : wavFilePath;
                  playSoundFile(cleanedFilePath);
              })();
              }, 1000); // 5 seconds delay
            } else {
                KeyWordRNBridge.stopKeywordDetection();
                // Setup react-native-background-fetch 
            }
          // Revert back to the listening message after 10 seconds
          setTimeout(() => {
            KeyWordRNBridge.startKeywordDetection();    
            setMessage(`Listening to WakeWord '${wakeWord}'...`);
            setIsFlashing(false);  // Stop flashing effect (Line 126)
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

