/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import RNFS from 'react-native-fs';

import React, { useEffect, useState } from 'react';

import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import type { PropsWithChildren } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Dimensions,
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

// Get screen width
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Define a scaling function based on screen width
const scaleFontSize = (size) => (SCREEN_WIDTH / 390) * size; // 390 is the width of iPhone 11

import Sound from 'react-native-sound';

// Enable playback in silence mode on iOS
Sound.setCategory('Playback');

let isPlaying = false;

const playSound = (fileName: String) => {
  //while (isPlaying == true) {

  //}
  const sound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      console.log('Failed to load the sound', error);
      return;
    }
    isPlaying = true;
    // Play the sound
    sound.play((success) => {
      if (success) {
        console.log('Successfully finished playing');
      } else {
        console.log('Playback failed');
      }
    });
    isPlaying = false;
  });
};


import LinearGradient from 'react-native-linear-gradient';
//import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';

// Import the setup file first
//import './BackgroundTimerSetup';
import BackgroundTimer from 'react-native-background-timer';

// Now use BackgroundTimer as usual
BackgroundTimer.start();

import { AppState } from 'react-native';

import { setupTrackPlayer, playTrackPlayer, playTrackPlayer_1 } from './src/player';

const { ForegroundServiceModule } = NativeModules;
// Start the foreground service when you start playing audio
if (Platform.OS != 'ios')
  ForegroundServiceModule.startAudioForegroundService();

import { useModel } from './src/useModel';

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

const detectionCallback = async (keywordIndex: any) => {
  //bringAppToForeground();
  console.log("detectionCallback !!!!!!!!!!!!!!!!!!");
  /*playTrackPlayer()
    .then(() => {
      console.log("Track started playing successfully.");
    })
    .catch((error) => {
      console.error("Failed to play track:", error);
    });*/
  // playSound('carparkoptions.mp3');
  playSound('activationcommand.mp3');
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
  try {

    const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
    console.log("AudioPermissionComponent()");
    await request(permission);
    console.log("AudioPermissionComponent() after request();");
    let MicStatus = await check(permission);
    if (MicStatus !== RESULTS.GRANTED) {
      console.log("MicStatus !== RESULTS.GRANTED calling request()");

      MicStatus = await request(permission);

      console.log("request() returned with MicStatus == ", MicStatus == RESULTS.GRANTED ? "permission granted" : "No permissions");

    }

    /*
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
    */
    if (MicStatus !== RESULTS.GRANTED) {
      console.log("calling AudioPermissionComponent() again");
      await AudioPermissionComponent();
    }
  } catch (error) {
    console.log('Error calling permissions:', error);
  }
}


type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({ children, title }: SectionProps): React.JSX.Element {
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
  const [isFlashing, setIsFlashing] = useState(true);
  const wakeWordFile = "hey_pango.onnx";
  const wakeWord = formatWakeWord(wakeWordFile);
  const { stopListening, loadModel } = useModel();

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const sparkMain = `sPark Your\n'Hands Free'\nParking Companion`;
  const endOfDemo = `\n          END OF DEMO \n       For info contact \n         ofer@davoice.io\n`

  // State to handle the display message
  const [message, setMessage] = useState(sparkMain);
  const [message1, setMessage1] = useState(`\n\n\nYou can say:\n`);
  const [message2, setMessage2] = useState(`'${wakeWord}'\n`);
  const [message3, setMessage3] = useState(`to activate voice commands`);
  const [message4, setMessage4] = useState(``);
  const [message41, setMessage4_1] = useState(``);
  const [message5, setMessage5] = useState(`Say: "step back" for main menue`);

  let innerDetectionCallback: (keywordIndex: any) => Promise<void>;

  useEffect(() => {
    const step0 = () => {
      // State to handle the display message
      setMessage(sparkMain);
      setMessage1(`\n\n\nYou can say:\n`);
      setMessage2(`'${wakeWord}'\n`);
      setMessage3(`to activate voice commands`);
      setMessage4_1(``);
      setMessage4(``);
    }

    const initializeKeywordDetection = async () => {
      try {
        step0();

        const innerDetectionCallbackStage3 = async (keywordIndex: string) => {
          if (keywordIndex.includes("step_back")) {
            step0();
            loadModel('state1', innerDetectionCallback);
            return;
          }
        };

        const innerDetectionCallbackStage2 = async (keywordIndex: string) => {
          console.log("innerDetectionCallbackStage2()", keywordIndex);
          playSound('you_chose.mp3');
          await stopListening();
          loadModel('step_back', innerDetectionCallback);
          const timeoutId = BackgroundTimer.setTimeout(async () => {
            BackgroundTimer.clearTimeout(timeoutId);
            //          setIsFlashing(true);  // Start flashing effect (Line 122)
            if (keywordIndex.includes("step_back")) {
              console.log("Stepping back");
              playSound('to_step_back.mp3');
              step0();
              loadModel('state1', innerDetectionCallback);
              return;
            } else if (keywordIndex.includes("nearest_gaz_station")) {
              console.log("Nearest gas station");
              playSound('to_find_the_nearest_gas_station.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nFind the nearest gas station`);
              setMessage2('');
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else if (keywordIndex.includes("i_want_to_stop_park")) {
              console.log("stop parking");
              playSound('to_stop_parking.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nTo stop parking`);
              setMessage2(``);
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else if (keywordIndex.includes("electric_vehicle_parking")) {
              console.log("electric_vehicle_parking");
              playSound('to_find_an_electical_vehicle_parking.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\n To find electric vehicle parking`);
              setMessage2(``);
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else {
              playSound('to_park_your_car.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nTo park your car`);
              setMessage2(``);
              setMessage3(``);
              setMessage4(``);
              setMessage4_1(``);
              //await detectionCallback(keywordIndex);
              // if (1 || !AppState.currentState.match(/background/)) {
              setTimeout(() => {
                (async () => {
                  setMessage1(`\n\n\nTo park your car`);
                  setTimeout(() => {
                    (async () => {
                      setMessage3(`When do you want to start parking?\n`);
                      setTimeout(() => {
                        (async () => {
                          setMessage4(endOfDemo);
                        })();
                      }, 2500); // 1 seconds delay      
                    })();
                  }, 2500); // 1 seconds delay      
                })();
              }, 2500); // 1 seconds delay
            }
            BackgroundTimer.setTimeout(async () => {
              playSound('contact_us.mp3');
            }, 2000);
          }, 1500);
        };

        innerDetectionCallback = async (keywordIndex: any) => {
          let innerDetectionCallbackTimeCalled = false;
          innerDetectionCallbackTimeCalled = false;
          if (keywordIndex.includes("step_back")) {
            console.log("Stepping back");
            step0();
            loadModel('state1', innerDetectionCallback);
            return;
          }
          await stopListening();
          console.log("innerDetectionCallback()");
          await detectionCallback(keywordIndex);
          setMessage(`\nChoose option:\n`);
          setMessage1(``);
          setMessage2(``);
          setMessage3(``);
          setMessage4_1(``);
          setMessage4(``);
          //let timeoutId = BackgroundTimer.setTimeout(() => {
          setMessage1(`\n\n\nSay: I want to park`);
          //BackgroundTimer.runBackgroundTimer(async () => {
          //setTimeout(() => {
          //(async () => {
          setMessage3(`Say: I want to stop parking\n`);
          //BackgroundTimer.runBackgroundTimer(async () => {
          //                          setTimeout(() => {
          //(async () => {
          setMessage4(`Say: Nearest gas station\n`);
          //BackgroundTimer.runBackgroundTimer(async () => {
          //                              setTimeout(() => {
          //(async () => {
          setMessage4_1(`Say: Electric vehicle parking\n`);
          // Start a timer that runs once after X milliseconds
          const timeoutId = BackgroundTimer.setTimeout(async () => {
            await loadModel('state2', innerDetectionCallbackStage2);
            //BackgroundTimer.clearTimeout(timeoutId);
          }, 12000);

          // Cancel the timeout if necessary
          //})();
          //}, 1000); // 1 seconds delay      
          //})();
          //}, 1000); // 1 seconds delay      
          //            })();
          //}, 1000); // 1 seconds delay
          // Setup react-native-background-fetch 
        }
        loadModel('step_back', innerDetectionCallback);
        loadModel('state1', innerDetectionCallback);

        console.log("Calling setupTrackPlayer()");
        //await setupTrackPlayer();
        console.log("Calling playTrackPlayer()");
        //await playTrackPlayer_1();
        //await playTrackPlayer_1();
        //await playTrackPlayer_1();
        //await playTrackPlayer();
        //await playTrackPlayer();
      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };
    initializeKeywordDetection();  // Call the async function inside useEffect
    console.log("Calling AudioPermissionComponent();");
    // Wait for audio permission to be granted
    AudioPermissionComponent();
    console.log("After calling AudioPermissionComponent();");

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
          {
            backgroundColor:
              isFlashing ? (isDarkMode ? '#ff4d4d' : '#ffcccc') : isDarkMode ? Colors.black : Colors.white
          }]}>
          <Text style={styles.title}>{message}</Text>
          <Text style={styles.header}>{message1}</Text>
          <Text style={styles.normal}>{message2}</Text>
          <Text style={styles.header}>{message3}</Text>
          <Text style={styles.header}>{message4}</Text>
          <Text style={styles.header}>{message41}</Text>
          <Text style={styles.stepback}>{message5}</Text>
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
    padding: 0,
    marginTop: 32,
    textAlign: 'left', // Align all text to the left
  },
  linearGradient: {
    flex: 1,
  },
  title: {
    fontSize: scaleFontSize(35),
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
  header: {
    fontSize: scaleFontSize(20),
    textAlign: 'left', // Align all text to the left
    fontWeight: 'bold',
    color: 'black',
  },
  stepback: {
    fontSize: scaleFontSize(14),
    textAlign: 'left', // Align all text to the left
    fontWeight: 'bold',
    color: 'blue',
    fontStyle: 'italic', // Make the text italic
  },
  normal: {
    textAlign: 'left', // Align all text to the left
    fontSize: scaleFontSize(25),
    color: 'blue',
    fontWeight: 'bold',
  },
  highlight: {
    textAlign: 'left', // Align all text to the left
    fontSize: scaleFontSize(18),
    fontWeight: 'bold',
    color: 'red'
  },
});

export default App;
