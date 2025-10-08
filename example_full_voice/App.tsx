/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import RNFS from 'react-native-fs';

import React, { useEffect, useState, useRef } from 'react';

import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// If you want to use only TTS:
//import { DaVoiceTTSInstance } from 'react-native-davoice-tts';
// let tts = new DaVoiceTTSInstance();
// If you want to use only STT
//import STT from 'react-native-davoice-tts/stt';
import Speech from 'react-native-davoice-tts/speech';
// import Speech from '@react-native-voice/voice';

import type { PropsWithChildren } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Platform,
  useColorScheme,
  View,
  AppState,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

import LinearGradient from 'react-native-linear-gradient';

// import KeyWordRNBridge from 'react-native-wakeword';
import { KeyWordRNBridgeInstance } from 'react-native-wakeword-sid';
import removeAllRNBridgeListeners from 'react-native-wakeword-sid';
import { createKeyWordRNBridgeInstance } from 'react-native-wakeword-sid';
import { createSpeakerIdInstance } from 'react-native-wakeword-sid/speakerid';

const sidId = 'sid1';
const sidScoreAccept = 0.65; // tweak to your taste

let calledOnce = false;

interface instanceConfig {
  id: string;
  modelName: string;
  threshold: number;
  bufferCnt: number;
  sticky: boolean;
  msBetweenCallbacks: number;
}

const modelName = 'hey_lookdeep' + (Platform.OS === 'ios' ? '.onnx' : '.dm');
// Create an array of instance configurations
const instanceConfigs: instanceConfig[] = [
  { id: 'multi_model_instance', modelName, threshold: 0.99, bufferCnt: 3, sticky: false, msBetweenCallbacks: 1000 },
];

// Helper function to format the ONNX file name
const formatWakeWord = (fileName: string) => {
  return fileName
    .replace(/(_model.*|_\d+.*)\.onnx$/, '')
    .replace(/_/g, ' ')
    .replace('.onnx', '')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const AudioPermissionComponent = async () => {
  const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
  await request(permission);
  const status = await check(permission);
  if (status !== RESULTS.GRANTED) {
    await request(permission);
  }
  if (Platform.OS !== 'ios') {
    // FOREGROUND_SERVICE on Android
    const foregroundServicePermission = await request('android.permission.FOREGROUND_SERVICE' as any);
    if (foregroundServicePermission === RESULTS.GRANTED) {
      console.log('Permissions granted', 'Microphone and foreground service permissions granted.');
    } else {
      console.log('Permission denied', 'Foreground service microphone permission is required.');
    }
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

type DetectionCallback = (event: any) => void;

// --- instance creation (kept exactly as in your code) ---
async function addInstance(conf: instanceConfig): Promise<KeyWordRNBridgeInstance> {
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

async function addInstanceMulti(conf: instanceConfig): Promise<KeyWordRNBridgeInstance> {
  const id = conf.id;
  const instance = await createKeyWordRNBridgeInstance(id, false);
  if (!instance) {
    console.error(`Failed to create instance ${id}`);
  }
  console.log(`Instance ${id} created ${instance}`);

  const modelNames = instanceConfigs.map((c) => c.modelName);
  const thresholds = instanceConfigs.map((c) => c.threshold);
  const bufferCnts = instanceConfigs.map((c) => c.bufferCnt);
  const msBetweenCallbacks = instanceConfigs.map((c) => c.msBetweenCallbacks);

  await instance.createInstanceMulti(modelNames, thresholds, bufferCnts, msBetweenCallbacks);
  console.log(`Instance ${id} createInstance() called`);
  return instance;
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFlashing, setIsFlashing] = useState(false);
  const wakeWords = instanceConfigs.map((config) => formatWakeWord(config.modelName)).join(', ');

  // --- FIX: persist across renders ---
  const myInstanceRef = useRef<KeyWordRNBridgeInstance | null>(null);
  const listenerRef = useRef<any>(null);
  
  const sidRef = useRef<any>(null);
  const [didInitSID, setDidInitSID] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // --- listener helpers (single-owner) ---
  const detachListener = async () => {
    const curr = listenerRef.current;
    if (curr && typeof curr.remove === 'function') {
      try {
        await curr.remove();
      } catch (e) {
        console.warn('listener.remove failed (ignored):', e);
      }
    }
    listenerRef.current = null;
  };

  const attachListenerOnce = async (
    instance: KeyWordRNBridgeInstance,
    callback: (phrase: string) => void
  ) => {
    await detachListener(); // ensure single active subscription
    const sub = instance.onKeywordDetectionEvent((phrase: string) => {
      const nice = formatWakeWord(phrase);
      console.log(`Instance ${instance.instanceId} detected: ${nice} with phrase`, nice);
      callback(nice);
    });
    console.log('eventListener == ', sub);
    listenerRef.current = sub;
    return sub;
  };

  // --- Speaker-ID flows (kept) ---
  const initSpeakerIdWWD = async () => {
    try {
      const sidIdWWD = 'sidWWD';
      const sid = await createSpeakerIdInstance(sidIdWWD);
      await sid.createInstanceWWD();
      sidRef.current = sid;

      const hasDefault = await sid.initVerificationUsingCurrentConfig();
      if (!hasDefault) {
        setMessage('🎙️ Speaker setup: Please speak for ~3–5 seconds…');
        const ob = await sid.onboardFromMicrophoneWWD(3, 12000);
        setMessage(`✅ Enrolled (${ob.clusterSize} slices). Verifying…`);
        if (Platform.OS === 'android') await sleep(200);
      } else {
        setMessage('🔐 Found existing speaker profile. Verifying…');
      }

      const res = await sid.verifyFromMicrophoneWWD(6000);
      const ok = (res?.bestScore ?? 0) >= sidScoreAccept;
      console.log(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
      setMessage(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
    } catch (err) {
      console.error('[SpeakerId] init failed:', err);
      setMessage('⚠️ Speaker verification failed (see logs).');
    }
  };

  const initSpeakerId = async () => {
    try {
      const sid = await createSpeakerIdInstance(sidId);
      await sid.createInstance();
      sidRef.current = sid;

      const hasDefault = await sid.initVerificationUsingDefaults();

      if (!hasDefault) {
        setMessage('🎙️ Speaker setup: Please speak for ~3–5 seconds…');
        const ob = await sid.onboardFromMicrophone(12000);
        setMessage(`✅ Enrolled (${ob.clusterSize} slices). Verifying…`);
        if (Platform.OS === 'android') await sleep(200);
      } else {
        setMessage('🔐 Found existing speaker profile. Verifying…');
      }

      const res = await sid.verifyFromMicrophone(8000);
      const ok = (res?.bestScore ?? 0) >= sidScoreAccept;
      console.log(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
      setMessage(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
    } catch (err) {
      console.error('[SpeakerId] init failed:', err);
      setMessage('⚠️ Speaker verification failed (see logs).');
    }
  };

  // permissions + appstate
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        try {
          await AudioPermissionComponent();
          setIsPermissionGranted(true);
        } catch (error) {
          console.error('Error requesting permissions:', error);
        }
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);
    if (AppState.currentState === 'active') {
      handleAppStateChange('active' as any);
    }
    return () => {
      appStateListener.remove();
    };
  }, []);

  useEffect(() => {
    if (isPermissionGranted && !didInitSID) {
      // initSpeakerIdWWD();
      // initSpeakerId();
      setDidInitSID(true);
    }
  }, [isPermissionGranted]);

  // UI message + Speech state (kept)
  const [message, setMessage] = useState(`Listening to WakeWords '${wakeWords}'...`);
  let lastPartialTime = 0;
  let timeoutId: any = null;
  let vadCBintervalID: any = null;
  let silenceThresholdMs = 2000;
  let lastTranscript = '';
  let lastProcessed = '';

  const SILENCE_TIMEOUT = 2000;
  function resetTranscript() {
    lastTranscript = '';
  }

  // Speech handlers (kept)
  Speech.onSpeechError = async (e) => {
    console.log('onSpeechError error ignored: ', e);
    if (e?.error?.code == 11 || e?.error?.message === 'Unknown error') {
      console.log('onSpeechError error 11', e);
    } else if (e?.error?.code === '7' || e?.error?.message === 'No match') {
      console.log('onSpeechError error 7', e);
      //await Speech.start('en-US');
    }
  };

  Speech.onSpeechStart = async () => {
    console.log('Speech started');
  };
  Speech.onSpeechEnd = async () => {
    console.log('***Sentence ended***:', lastTranscript);
    if (lastTranscript == '') {
      return;
    }
    Speech.speak(lastTranscript, 0);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    lastTranscript = '';
    //await Speech.start('en-US');
  };
  Speech.onSpeechPartialResults = (e) => {
    const curr = e.value?.[0];
    if (Platform.OS === 'ios') {
      if (curr && curr !== lastTranscript) {
        lastTranscript = curr;
        lastPartialTime = Date.now();
        console.log('Partial:', curr);
      }
      return;
    }
    console.log('Partial:', curr);
    if (!curr || !curr.trim()) return;
    if (curr == undefined) {
      console.log('Partial is undefined!!!!!!');
      return;
    }
    lastTranscript = curr;

    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      console.log('⏳ Silence timeout reached, speaking:', lastTranscript);
      const newText = lastTranscript.slice(lastProcessed.length).trim();
      if (newText.length > 0) {
        console.log('🗣️ Speaking:', newText);
        //await Speech.speak(newText, 0);
        lastProcessed = lastTranscript;
      }
      //await Speech.start('en-US');
    }, silenceThresholdMs);
  };

  Speech.onSpeechResults = async (e) => {
    console.log('Results: ', e.value?.[0]);
    const current = e.value?.[0];
    if (!current || current === lastTranscript) return;

    const newWords = current.replace(lastTranscript, '').trim();
    lastTranscript = current;

    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      console.log('⏳ Silence timeout reached, speaking:', lastTranscript);
      const newText = lastTranscript.slice(lastProcessed.length).trim();
      if (newText.length > 0) {
        console.log('🗣️ Speaking:', newText);
        await Speech.speak(newText, 0);
        lastProcessed = lastTranscript;
      }
    }, silenceThresholdMs);

    console.log('Heard new words:', newWords);
  };

  useEffect(() => {
    // === keyword callback ===
    const keywordCallback = async (keywordIndex: any) => {
      const instance = myInstanceRef.current;
      if (!instance) return;

      // 1) Remove listener first (prevents late events)
      await detachListener();

      // 2) Stop detection (native)
      try {
        await instance.stopKeywordDetection();
      } catch {}

      console.log('detected keyword: ', keywordIndex);
      setMessage(`WakeWord '${keywordIndex}' DETECTED`);
      setIsFlashing(true);

      try {
        await Speech.initAll({ locale:'en-US', model: 'model.onnx' });
        console.log('Calling Speech.start');
        const off = Speech.onFinishedSpeaking = () => {
          console.log('✅ Finished speaking (last WAV done).');
        };
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }

      await Speech.speak("Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!");
      /*
      await Speech.speak(
        "Hello. \
Wellcome to The Voice! \
The first Speech to Speech! Package for react native!",
        0
      );
*/
      // Restart detection after timeout
      setTimeout(async () => {
        console.log('5 seconds have passed!');
        setMessage(`Listening to WakeWords '${wakeWords}'...`);
        setIsFlashing(false);

        await Speech.destroyAll();

        if (Platform.OS === 'android') {
          await sleep(300);
        }

        // re-attach listener then start detection
        await attachListenerOnce(instance, keywordCallback);
        await instance.startKeywordDetection(instanceConfigs[0].threshold);
      }, 50000);
    };

    const updateVoiceProps = async () => {
      const inst = myInstanceRef.current;
      if (!inst) return;
      try {
        const voiceProps = await inst.getVoiceProps();
        // use if needed
      } catch (error) {
        console.error('Error fetching voice properties:', error);
      }
    };

    const initializeKeywordDetection = async () => {
      try {
        try {
          console.log('Adding element:', instanceConfigs[0]);
          const instance = await addInstanceMulti(instanceConfigs[0]);
          myInstanceRef.current = instance;
        } catch (error) {
          console.error('Error loading model:', error);
          return;
        }

        const inst = myInstanceRef.current!;
        await attachListenerOnce(inst, keywordCallback);

        const isLicensed = await inst.setKeywordDetectionLicense(
          // "MTc0OTkzNDgwMDAwMA==-QOkSZvHDA+qRiN/vX2Kp2xt30+hro4jze3dzJJAeEMc=");
          'MTc2NzEzMjAwMDAwMA==-05jR9f/gn4F/SyNwjbdLHIfTaCJK4VYdikxSVxAJcDk='
        );

        await inst.startKeywordDetection(instanceConfigs[0].threshold);

        if (!isLicensed) {
          console.error('No License!!! - setKeywordDetectionLicense returned', isLicensed);
        }

        // // stress loop (kept) — now with safe listener lifecycle
        // let cnt = 20;
        // while (cnt > 0) {
        //   console.log('in start / stop loop cnt == ', cnt);

        //   // remove listener first, then stop, then re-attach and start
        //   await detachListener();
        //   try {
        //     await inst.stopKeywordDetection();
        //   } catch {}
        //   await attachListenerOnce(inst, keywordCallback);
        //   await inst.startKeywordDetection(instanceConfigs[0].threshold);

        //   cnt = cnt - 1;
        // }

        // small scheduled TTS tests (kept structure)
        let ms = 5000;
        while (ms <= 10000) {
          setTimeout(async () => {
            // await Speech.speak('Hey, Look deep', 0);
          }, ms);
          ms += 2000;
        }

        // vadCBintervalID = setInterval(updateVoiceProps, 200);
      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };

    if (!calledOnce) {
      calledOnce = true;
      console.log('Calling initializeKeywordDetection();');
      initializeKeywordDetection();
      console.log('After calling AudioPermissionComponent();');
    }

  }, [isPermissionGranted && didInitSID]); // same dependency

  /*
  // 🔴 REAL UNMOUNT CLEANUP ONLY
  useEffect(() => {
    return () => {
      (async () => {
        try {
          await detachListener();
          if (myInstanceRef.current) {
            try { await myInstanceRef.current.stopKeywordDetection(); } catch {}
          }
          await Speech.destroy();
          if (intervalRef.current) clearInterval(intervalRef.current);
        } catch {}
      })();
    };
  }, []); // <-- empty deps => runs only on unmount (not on dep changes)
*/

  return (
    <LinearGradient
      colors={isDarkMode ? ['#232526', '#414345'] : ['#e0eafc', '#cfdef3']}
      style={styles.linearGradient}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={backgroundStyle}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isFlashing ? (isDarkMode ? '#ff4d4d' : '#ffcccc') : isDarkMode ? Colors.black : Colors.white,
            },
          ]}>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default App;
