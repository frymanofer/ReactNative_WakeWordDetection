/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

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
  AppState, // [STYLE CHANGE: moved from separate import to here for clarity]
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
const scaleFontSize = (size: number) => (SCREEN_WIDTH / 390) * size; // 390 is iPhone 11 width for reference

import Sound from 'react-native-sound';

import useVoiceRecognition from './src/voiceRecog'; // adjust path if necessary
import TextToVoiceService from './src/textToVoice';

async function setVoiceService() {
  // Set language, rate, pitch, and voice
  TextToVoiceService.setLanguage('en-US');
  TextToVoiceService.setRate(0.5);
  TextToVoiceService.setPitch(1.0);

  // Get available voices and choose one
  const voices = await TextToVoiceService.getAvailableVoices();
  if (voices.length > 0) {
    let voiceID = '';
    console.log("Available voices:");
    voices.forEach((voice) => {
      if (voice.language.match('en-US')) {
        console.log(voice.id);
        TextToVoiceService.setVoice(voice.id);
      }
    });
  }
  if (Platform.OS == 'ios') {
    TextToVoiceService.setVoice('com.apple.voice.compact.en-US.Samantha');
  }
}

// Enable playback in silence mode on iOS
// Sound.setCategory('Playback');
// The above is a BUG!!!! you need PlayAndRecord and true to MixwithOthers!!!
Sound.setCategory('PlayAndRecord', true);
//Sound.setCategory('PlayAndRecord', true);
//Sound.setMode('VoiceChat');

let isPlaying = false;

const playSound = async (fileName: String) => {
  const sound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      console.log('Failed to load the sound', error);
      return;
    }
    sound.setSpeakerphoneOn(true);
    // ... Any future usage of 'sound.play' was commented out in your code
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

import { setupTrackPlayer, playTrackPlayer, playTrackPlayer_1 } from './src/player';

const { ForegroundServiceModule } = NativeModules;
// Start the foreground service when you start playing audio
if (Platform.OS != 'ios') {
  ForegroundServiceModule.startAudioForegroundService();
}

import { useModel } from './src/useModel';

function bringAppToForeground() {
  if (Platform.OS === 'ios')
    return;
  console.log("ForegroundServiceModule == ", ForegroundServiceModule);
  ForegroundServiceModule.bringAppToForeground()
    .then(() => {
      console.log('Called bringing app to foreground');
    })
    .catch((error) => {
      console.error('Error bringing app to foreground:', error);
    });
}

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

function formatTime(timeStr) {
  if (timeStr == null || timeStr == undefined)
    return '';
  
  if (timeStr.length !== 4) {
    return timeStr;
  }
  return timeStr.slice(0, 2) + ':' + timeStr.slice(2);
}

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

    if (MicStatus !== RESULTS.GRANTED) {
      console.log("calling AudioPermissionComponent() again", MicStatus);
      await AudioPermissionComponent();
    }
  } catch (error) {
    console.log('Error calling permissions:', error);
  }
};

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

function extractTime(text: string) {
  // Regular expression to match "HH:MM" or "HHMM" formats
  const timePattern = /\b(\d{2}:\d{2}|\d{4})\b/;
  const match = text.match(timePattern);
  return match ? match[0] : null;
}

var calledOnce = false;

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFlashing, setIsFlashing] = useState(true);

  // Example .onnx file
  const wakeWordFile = "genious.onnx";
  const wakeWord = formatWakeWord(wakeWordFile);

  const { stopListening, loadModel, replaceAllCB } = useModel();

  const sparkMain = `sPark\n'Hands Free'\nParking App`;
  const endOfDemo = `\n          END OF DEMO \n       For info contact \n         ofer@davoice.io\n`;

  const [message, setMessage] = useState(sparkMain);
  const [message1, setMessage1] = useState(`\n\n\nYou can say:\n`);
  const [message2, setMessage2] = useState(`'${wakeWord}'\n`);
  const [message3, setMessage3] = useState(`to activate voice commands`);
  const [message4, setMessage4] = useState(``);
  const [message41, setMessage4_1] = useState(``);
  const [message5, setMessage5] = useState(`Say: "step back" for main menue`);

  const language = 'en-US';
  const { getTextDetected, recognizedText, vrClearBuffer, vrIsListening, vrStartListening, vrStopListening } = useVoiceRecognition(language);

  let innerDetectionCallback: (keywordIndex: any) => Promise<void>;

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
    
    return () => {
      eventListener.remove();
    };
  }, []);

  useEffect(() => {
    const step0 = () => {
      setMessage(sparkMain);
      setMessage1(`\n\n\nYou can say:\n`);
      setMessage2(`'${wakeWord}'\n`);
      setMessage3(`to activate voice commands`);
      setMessage4_1(``);
      setMessage4(``);
    };

    const initializeKeywordDetection = async () => {

      try {
        step0();

        const innerDetectionCallbackStage3 = async (keywordIndex: string) => {
          if (keywordIndex.includes("step_back")) {
            step0();
            await loadModel('state1', innerDetectionCallback);
            return;
          }
        };
        //Sound.setMode('VoiceChat');

        const innerDetectionCallbackStage2 = async (keywordIndex: string) => {
          //await stopListening();
          console.log("innerDetectionCallbackStage2()", keywordIndex);
          //playSound('you_chose.mp3');
          let initialMessage = "You Chose, ";

          //await loadModel('step_back', innerDetectionCallback);
          //await replaceAllCB(innerDetectionCallback);
          const timeoutId = BackgroundTimer.setTimeout(async () => {
            BackgroundTimer.clearTimeout(timeoutId);
            //          setIsFlashing(true);  // Start flashing effect (Line 122)
            console.log("keywordIndex == ", keywordIndex);

            if (keywordIndex.includes("step_back")) {
              console.log("Stepping back");
              //playSound('to_step_back.mp3');
              await TextToVoiceService.speak(initialMessage + "To, step back");

              step0();
              await replaceAllCB(innerDetectionCallback);

              await loadModel('state1', innerDetectionCallback);
              return;
            } else if (keywordIndex.includes("nearest_gaz_station")) {
              console.log("Nearest gas station");
              //playSound('to_find_the_nearest_gas_station.mp3');
              await TextToVoiceService.speak(initialMessage + "To, find the nearest gas station");

              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nFind the nearest gas station`);
              setMessage2('');
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else if (keywordIndex.includes("i_want_to_stop_park")) {
              console.log("stop parking");
              await TextToVoiceService.speak(initialMessage + "To, stop parking");
              //playSound('to_stop_parking.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nTo stop parking`);
              setMessage2(``);
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else if (keywordIndex.includes("electric_vehicle_parking")) {
              console.log("electric_vehicle_parking");
              await TextToVoiceService.speak(initialMessage + 'to_find_an_electical_vehicle_parking.mp3');
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\n To find electric vehicle parking`);
              setMessage2(``);
              setMessage3(endOfDemo);
              setMessage4_1(``);
              setMessage4(``);
            } else {
              //playSound('to_park_your_car.mp3');
              await TextToVoiceService.speak(initialMessage + "To, park your car, when do you want to start parking?");
              setMessage(`\nyou chose:\n`);
              setMessage1(`\n\n\nTo park your car`);
              setMessage2(``);
              setMessage3(``);
              setMessage4(``);
              setMessage4_1(``);
              setMessage1(`\n\n\nTo park your car`);
              setMessage3(`When do you want to start parking?\n`);
              await stopListening();
              //stopListening();
              //vrStartListening();
              var timeOutId = BackgroundTimer.setTimeout(async () => {
                BackgroundTimer.clearTimeout(timeOutId);
                vrStartListening();
              }, 2000);
              var timeOutId3 = BackgroundTimer.setTimeout(async () => {
                BackgroundTimer.clearTimeout(timeOutId3);
                const text = formatTime(extractTime(getTextDetected()));
                console.log("*** getTextDetected() *** == ", text);
                const timestamp = Date.parse(text);
                console.log("*** timestamp == *** == ", timestamp);

                if (!isNaN(timestamp)) {
                  setMessage3(`You chose to start parking at: ${timestamp} \n`);
                  await TextToVoiceService.speak(`You chose, to start parking at: ${timestamp}`);

                } else {
                  setMessage3(`You chose to start parking at: ${text} \n`);
                  await TextToVoiceService.speak(`You chose, to start parking at: ${text}`);
                }
                vrClearBuffer();
                await replaceAllCB(innerDetectionCallback);

                await loadModel('step_back', innerDetectionCallback);
              }, 10000);
              setMessage4(endOfDemo);
              const timeOutId2 = BackgroundTimer.setTimeout(async () => {
                BackgroundTimer.clearTimeout(timeOutId2);
                await TextToVoiceService.speak(`End of Demo, If you want to see more please contact us at Davoice dot io`);
                //playSound('contact_us.mp3');
              }, 14000);
              return;
            }
            const timeOutId2 = BackgroundTimer.setTimeout(async () => {
              BackgroundTimer.clearTimeout(timeOutId2);
              await TextToVoiceService.speak(`End of Demo, If you want to see more please contact us at Davoice dot io`);
              //playSound('contact_us.mp3');
            }, 2000);
          }, 1500);
        };

        const innerDetectionCallback = async (keywordIndex: any) => {
          //await stopListening();
          if (keywordIndex.includes("step_back")) {
            console.log("Stepping back");
            step0();
            await replaceAllCB(innerDetectionCallback);

            await loadModel('state1', innerDetectionCallback);
            return;
          }
          console.log("innerDetectionCallback()");
          await detectionCallback(keywordIndex);
          //playSound('activationcommand.mp3');
          const sentance = // "Wait for this message to be over,    , then," +
            // "you will be able to control the app,   , by saying commands such as,       ,:" +
            "control the app, by saying commands such as,       ,:" +
            "I want to park, I want to stop parking, find the neareast gas station, or, nearest electric vehicle parking";
          //const timeoutIdx = BackgroundTimer.setTimeout(async () => {
            //BackgroundTimer.clearTimeout(timeoutIdx);
            await TextToVoiceService.speak(sentance);
         // }, 500);
          setMessage(`\nChoose option:\n`);
          setMessage1(``);
          setMessage2(``);
          setMessage3(``);
          setMessage4_1(``);
          setMessage4(``);

          // Just simulating some prompt updates
          setMessage1(`\n\n\nSay: I want to park`);
          setMessage3(`Say: I want to stop parking\n`);
          setMessage4(`Say: Nearest gas station\n`);
          setMessage4_1(`Say: Electric vehicle parking\n`);

          // Example delayed load
          const timeoutId = BackgroundTimer.setTimeout(async () => {
            BackgroundTimer.clearTimeout(timeoutId);
            await loadModel('state2', innerDetectionCallbackStage2);
            await replaceAllCB(innerDetectionCallbackStage2);
 //         }, 12000);
          // }, 8000);
           }, 100);
        };
        await loadModel('all', innerDetectionCallback);
        await setVoiceService();
        console.log("**************** TextToVoiceService.speak *************** ");
        await TextToVoiceService.speak("Welcom to Spark, Voice Activated, hands free parking and public transportation app");
  
        //await loadModel('step_back', innerDetectionCallback);
        //await loadModel('state1', innerDetectionCallback);

        console.log("Calling setupTrackPlayer()");
        // Optional track player setup if needed
      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };

    if (!calledOnce) {
      calledOnce = true;
      console.log("Calling AudioPermissionComponent();");
      // AudioPermissionComponent();
      initializeKeywordDetection();
      console.log("After calling AudioPermissionComponent();");
    }
  }, [isPermissionGranted]);

  // [STYLE CHANGE] Updated gradient colors for a luxurious look
  const gradientColors = isDarkMode
    ? ['#232526', '#414345']
    : ['#e0eafc', '#cfdef3'];

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    // [STYLE CHANGE] Wrap root in a gradient
    <LinearGradient
      colors={gradientColors}
      style={styles.linearGradient}>

      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>

        {/* [STYLE CHANGE] Container with some "card" styling inside the gradient */}
        <View style={[styles.container, {
          // Using color if you want a slight overlay background
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'
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
  linearGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    minHeight: Dimensions.get('window').height * 0.85, // Enough height so we have space
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 32,
    textAlign: 'left',
    borderRadius: 16,               // [STYLE CHANGE] Rounded corners
    marginHorizontal: 10,
    marginBottom: 30,
    shadowColor: '#000',            // [STYLE CHANGE] Subtle shadow for iOS
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,                   // [STYLE CHANGE] Shadow for Android
  },
  title: {
    fontSize: scaleFontSize(30),
    fontWeight: 'bold',
    color: '#4a4a4a',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginHorizontal: 10,
  },
  header: {
    fontSize: scaleFontSize(20),
    textAlign: 'left',
    fontWeight: 'bold',
    color: '#2b2b2b',
    marginBottom: 6, // [STYLE CHANGE] Spacing
  },
  stepback: {
    fontSize: scaleFontSize(14),
    textAlign: 'left',
    fontWeight: 'bold',
    color: 'blue',
    fontStyle: 'italic',
    marginTop: 20,
  },
  normal: {
    textAlign: 'left',
    fontSize: scaleFontSize(25),
    color: '#BF3A85',  // [STYLE CHANGE] More luxurious color
    fontWeight: 'bold',
    marginBottom: 6,
  },
  highlight: {
    textAlign: 'left',
    fontSize: scaleFontSize(18),
    fontWeight: 'bold',
    color: 'red',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: scaleFontSize(24),
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: scaleFontSize(18),
    fontWeight: '400',
  },
});

export default App;
