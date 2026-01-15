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

// Two wakes to use react-native-wakeword via hooks
// suitable for react users.
// React - Use this for hooks:
// import useModel from 'react-native-wakeword';

//  or direct for simple js.
// Direct with JS:
// import KeyWordRNBridge from 'react-native-wakeword'; 
import { KeyWordRNBridgeInstance } from 'react-native-wakeword'; 
import removeAllRNBridgeListeners from 'react-native-wakeword'; 
import { createKeyWordRNBridgeInstance } from 'react-native-wakeword'; 

var calledOnce = false;

interface instanceConfig {
  id: string;
  modelName: string;
  threshold: number;
  bufferCnt: number;
  sticky: boolean;
  msBetweenCallbacks:number;
}
  // Create an array of instance configurations
  const instanceConfigs:instanceConfig[] = [
    { id: 'multi_model_instance', modelName: 'hey_lookdeep.onnx', threshold: 0.99, bufferCnt: 4 , sticky: false, msBetweenCallbacks: 1000 },
    { id: 'multi_model_instance', modelName: 'need_help_now.onnx', threshold: 0.99, bufferCnt: 4 , sticky: false, msBetweenCallbacks: 1000 },
    { id: 'multi_model_instance', modelName: 'coca_cola_model_28_05052025.onnx', threshold: 0.99, bufferCnt: 4 , sticky: false, msBetweenCallbacks: 1000 },
  ];

import { NativeModules } from 'react-native';
import { AppState } from 'react-native';


// Helper function to format the ONNX file name
const formatWakeWord = (fileName) => {
  return fileName
    .replace(/(_model.*|_\d+.*)\.onnx$/, '')  // Remove _model... or _<digits>... before .onnx
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

  
// ** OLD ** 
// Function to add a new instance dynamically
//async function addInstance(conf: instanceConfig) 
async function addInstance(
  conf: instanceConfig): Promise<KeyWordRNBridgeInstance> {
  const id = conf.id;
  const instance = await createKeyWordRNBridgeInstance(id, false);

  if (!instance) {
      console.error(`Failed to create instance ${id}`);
  }
  console.log(`Instance ${id} created ${instance}`);
  await instance.createInstance(conf.modelName, conf.threshold, conf.bufferCnt);
  console.log(`Instance ${id} createInstance() called`);
  return instance;
}

// ** NEW MULTI EFFICIENT MODELS **
// Function to add a new instance dynamically
// async function addInstance(conf: instanceConfig) 
async function addInstanceMulti(
  conf: instanceConfig): Promise<KeyWordRNBridgeInstance> {
  const id = conf.id;
  const instance = await createKeyWordRNBridgeInstance(id, false);

  if (!instance) {
      console.error(`Failed to create instance ${id}`);
  }
  console.log(`Instance ${id} created ${instance}`);
  // Group configs under the same instance ID (you can customize how to group them)

  const modelNames = instanceConfigs.map(conf => conf.modelName);
  const thresholds = instanceConfigs.map(conf => conf.threshold);
  const bufferCnts = instanceConfigs.map(conf => conf.bufferCnt);
  const msBetweenCallbacks = instanceConfigs.map(conf => conf.msBetweenCallbacks);

  await instance.createInstanceMulti(modelNames, thresholds, bufferCnts, msBetweenCallbacks);

//  await instance.createInstance(conf.modelName, conf.threshold, conf.bufferCnt);
  console.log(`Instance ${id} createInstance() called`);
  return instance;
}


async function set_callback(instance: KeyWordRNBridgeInstance, callback: (phrase: string) => void) { 
  const eventListener = instance.onKeywordDetectionEvent((phrase: string) => {
    phrase = formatWakeWord(phrase);
    console.log(`Instance ${instance.instanceId} detected: ${phrase} with phrase`, phrase);
    // callback(phrase); Does not work on IOS
    callback(phrase);
  });
  console.log("eventListener == ", eventListener);
  return eventListener;
}

// Function to remove the event listener
function removeEventListener(eventListener: any) {
  if (eventListener && typeof eventListener.remove === 'function') {
    eventListener.remove();
  }
  else {
    console.error("event listener.remove does not exist!!!!");
  }
}


function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFlashing, setIsFlashing] = useState(false);
  const wakeWords = instanceConfigs
  .map((config) => formatWakeWord(config.modelName))
  .join(", ");
// If you use useModel
//  console.log("useModel == ", useModel)
//  const { stopListening, startListening, loadModel, setKeywordDetectionLicense} = useModel();
  let myInstance: KeyWordRNBridgeInstance;
  let eventListener: any;
  console.log("App.tsx");
  console.log("App.tsx");
  console.log("App.tsx");
  
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const [isPermissionGranted, setIsPermissionGranted] = useState(false); // Track permission status
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          await AudioPermissionComponent();
          setIsPermissionGranted(true);
        } catch (error) {
          console.error("Error requesting permissions:", error);
        }
      }
    };
  
    const eventListener = AppState.addEventListener("change", handleAppStateChange);
  
    // If the app is *already* active on mount:
    if (AppState.currentState === 'active') {
      handleAppStateChange('active');
    }
  
    return () => {
      eventListener.remove();
    };
  }, []);

  // State to handle the display message
  const [message, setMessage] = useState(`Listening to WakeWords '${wakeWords}'...`);

  useEffect(() => {

    const keywordCallback = async (keywordIndex: any) => {
      // Stop detection
      await myInstance.stopKeywordDetection();
      // remove the listener and callback
      removeEventListener(eventListener);

      console.log ("detected keyword: ", keywordIndex);
      setMessage(`WakeWord '${keywordIndex}' DETECTED`);
      setIsFlashing(true);  // Start flashing effect (Line 122)

      const timeout = setTimeout(async () => {
        console.log('5 seconds have passed!');
        setMessage(`Listening to WakeWord '${wakeWords}'...`);
        setIsFlashing(false);  // Start flashing effect (Line 122)
        // Perform your action here
        // Stop detection
        eventListener = await set_callback(myInstance, keywordCallback);
        await myInstance.startKeywordDetection(instanceConfigs[0].threshold);
        // remove the listener and callback
      }, 5000);
    }

    const initializeKeywordDetection = async () => {
      try {        
        try {
          console.log('Adding element:', instanceConfigs[0]);
          myInstance = await addInstanceMulti(instanceConfigs[0]);
        } catch (error) {
            console.error("Error loading model:", error);
            return;
        }
        eventListener = await set_callback(myInstance, keywordCallback);
        const isLicensed = await myInstance.setKeywordDetectionLicense(
          "MTc2OTg5NjgwMDAwMA==-tB+lDJbxczzL6uDqBm2939PfZDEu3jDMjF+FhD+pywI=");
       await myInstance.startKeywordDetection(instanceConfigs[0].threshold);
        if (!isLicensed) {
          console.error("No License!!! - setKeywordDetectionLicense returned", isLicensed);
        }
        /* Using use_model.tsx:
        await setKeywordDetectionLicense(
          "MTczNDIxMzYwMDAwMA==-tNV5HJ3NTRQCs5IpOe0imza+2PgPCJLRdzBJmMoJvok=");
          
        await loadModel(instanceConfigs, keywordCallback);
  */
          
      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };

    if (!calledOnce) {
      calledOnce = true;
      console.log("Calling initializeKeywordDetection();");
      initializeKeywordDetection();
      console.log("After calling AudioPermissionComponent();");
    }

    // Call your native bridge function
  //KeyWordRNBridge.initKeywordDetection("bla", 0.9999, 2);
  //loadModel();
}, [isPermissionGranted]);  // Empty dependency array ensures it runs once when the component mounts


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

