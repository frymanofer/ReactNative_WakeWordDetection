/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import RNFS from 'react-native-fs';

import React, { useEffect, useState, useRef } from 'react';

import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  AppState,
} from 'react-native';

export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // 1) Check RECORD_AUDIO
    const has = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    if (has) return true;

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );

    if (status === PermissionsAndroid.RESULTS.GRANTED) return true;

    // Handle “never ask again”
    if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert(
        'Microphone permission required',
        'Please enable microphone permission in Settings.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel', style: 'cancel' }]
      );
    }
    return false;
  } else {
    // iOS: there’s no RN core API to pre-request mic.
    // The system prompt appears the first time you start recording.
    // You can *optionally* guide users to Settings if they previously denied.
    // Just return true here and ensure Info.plist is configured.
    return true;
  }
}

const moonRocksSound = require('./assets/cashRegisterSound.mp3');
const subtractMoonRocksSound = require('./assets/bellServiceDeskPressXThree.mp3');


// If you want to use only TTS:
import { DaVoiceTTSInstance } from 'react-native-davoice-tts';
let tts = new DaVoiceTTSInstance();
// If you want to use only STT
//import STT from 'react-native-davoice-tts/stt';
import Speech from 'react-native-davoice-tts/speech';
// import Speech from '@react-native-voice/voice';

import type { PropsWithChildren } from 'react';

// put near the top of App.tsx
const Colors = {
  white: '#FFFFFF',
  black: '#000000',
  light: '#D1D5DB',   // light gray
  dark: '#374151',    // dark gray
  lighter: '#F3F4F6', // very light background
  darker: '#111827',  // very dark background
} as const;

import LinearGradient from 'react-native-linear-gradient';

// import KeyWordRNBridge from 'react-native-wakeword';
import { KeyWordRNBridgeInstance } from 'react-native-wakeword';
import { createKeyWordRNBridgeInstance } from 'react-native-wakeword';
//import { createSpeakerIdInstance } from 'react-native-wakeword/speakerid';
// If you created audioRoutingConfig.ts in the lib:
import { setWakewordAudioRoutingConfig } from 'react-native-wakeword';
import type { AudioRoutingConfig } from 'react-native-wakeword';

// Ducking / Unducking
import {disableDucking, enableDucking} from 'react-native-wakeword';

// 
// 
// --> *** IMPORTANT IOS AUDIO SESSION CONFIG ***
// Set Audio session for IOS!!!!
// 
// 
const defaultAudioRoutingConfig: AudioRoutingConfig = {
  // Fallback when no special port match
  default: {
    category: 'playAndRecord',
    mode: 'measurement',
    options: [
      'mixWithOthers',
      'allowBluetooth',
      'allowBluetoothA2DP',
      'allowAirPlay',
    ],
    preferredInput: 'none',
  },
  byOutputPort: {
    // 1. CarPlay: run in CarPlay
    carAudio: {
      category: 'playAndRecord',
      mode: 'measurement',
      options: [
        'mixWithOthers',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'overrideMutedMicrophoneInterruption',
      ],
      preferredInput: 'none', // use CarPlay mic
    },

    // 2. Built-in receiver (earpiece): force speaker so user hears responses
    builtInReceiver: {
      category: 'playAndRecord',
      mode: 'measurement',
      options: [
        'mixWithOthers',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'defaultToSpeaker',
      ],
      preferredInput: 'none',
    },

    // **** PLEASE NOTE - YOU MAY WANT TO KEEP SPOTIFY ON HD SOUND AND NOT ENABLE MIC WHILE IN A2DP **********
    // 3. Bluetooth A2DP (Spotify etc) – capture from phone mic
    bluetoothA2DP: {
      category: 'playAndRecord',
      mode: 'measurement',
      options: [
        'mixWithOthers',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
      ],
      preferredInput: 'builtInMic',
    },

    // 4. Bluetooth HFP – call-like; you can later change this if needed
    bluetoothHFP: {
      category: 'playAndRecord',
      mode: 'measurement',
      options: [
        'mixWithOthers',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
      ],
      preferredInput: 'none', // use HFP mic by default
    },

    // 5. Wired headphones – play in ears, mic from phone
    headphones: {
      category: 'playAndRecord',
      mode: 'measurement',
      options: [
        'mixWithOthers',
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
      ],
      preferredInput: 'none',
    },
  },
};

/*
Ducking/Unducking TEMPORARY code until background timers are
enabled!!
 */

let unDuckingTimerId:any = null;
let unDuckingExpiration = 0;

export const scheduleUnDucking = async seconds => {
  const now = Date.now();
  if (seconds <= 2) {
    seconds = 2;
  }
  const newExpiration = now + seconds * 1000;

  // If a timer exists and it's already longer, skip
  if (unDuckingTimerId && newExpiration <= unDuckingExpiration) {
    return;
  }

  // Cancel any existing timer
  if (unDuckingTimerId) {
    clearTimeout(unDuckingTimerId);
    unDuckingTimerId = null;
  }

  unDuckingExpiration = newExpiration;

  const delay = newExpiration - now;
  unDuckingTimerId = setTimeout(async () => {
    if (unDuckingTimerId == null) {
      // Rat race for unducking.
      unDuckingTimerId = null;
      unDuckingExpiration = 0;
      return;
    }
    unDuckingTimerId = null;
    unDuckingExpiration = 0;
    await disableDucking();
  }, delay);
};

export const enableDuckingAndClearUnDucking = async () => {
  await enableDucking();
  if (unDuckingTimerId) {
    clearTimeout(unDuckingTimerId);
    unDuckingTimerId = null;
  }
  unDuckingExpiration = 0;
};

// Before playing wav file:
// await enableDuckingAndClearUnDucking();
// After playing wav file:
// await scheduleUnDucking()

// ******* END Ducking / Unducking ********

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
  return ensureMicPermission();
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
// === minimal coalescer that PRESERVES punctuation ===

  // ASCII word spans (safe for your English prompts). If you need full Unicode,
  // swap the regex to /\p{L}+\p{M}*|\p{N}+/gu (ensure your JS engine supports it).
  const _wordSpans = (s) => {
    const spans = [];
    const re = /[A-Za-z0-9]+/g;
    let m;
    while ((m = re.exec(s))) {
      spans.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
    }
    return spans;
  };

  const _stripPunc = (s) =>
    (s || '').toLowerCase().replace(/[^A-Za-z0-9\s]+/g, '').replace(/\s+/g, ' ').trim();

  const _overlapCount = (aWords, bWords) => {
    const max = Math.min(aWords.length, bWords.length);
    for (let k = max; k >= 1; k--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (aWords[aWords.length - k + i] !== bWords[i]) { ok = false; break; }
      }
      if (ok) return k;
    }
    return 0;
  };

  const mergeSmartKeepPunct = (prev, curr, minOverlap = 2) => {
    prev = (prev || '').trim();
    curr = (curr || '').trim();
    if (!prev) return curr;
    if (!curr) return prev;

    // Fast paths
    if (curr.startsWith(prev)) return curr;   // normal growth
    if (prev.startsWith(curr)) return prev;   // regression → keep longer

    // Punctuation-insensitive prefix (e.g., "Hey." → "Hey, how")
    const np = _stripPunc(prev);
    const nc = _stripPunc(curr);
    if (nc.startsWith(np)) return curr;

    // Word-overlap splice (compute on tokens, splice on ORIGINAL string)
    const pw = _wordSpans(prev).map(o => o.w);
    const cwSpans = _wordSpans(curr);
    const cw = cwSpans.map(o => o.w);

    const k = _overlapCount(pw, cw);
    if (k >= minOverlap) {
      // cut point = end of k-th word in ORIGINAL curr
      const cut = cwSpans[k - 1].end;
      const tail = curr.slice(cut); // keeps punctuation/spacing exactly

      // --- boundary de-dup JUST for merge-caused duplication of ?/! ---
      // If prev ends with ?/! run and tail begins with the same mark run,
      // drop the prev run and keep curr’s (so legit "???" from curr is preserved).
      const prevRun = prev.match(/[?!]+$/);
      const tailRun = tail.match(/^[?!]+/);
      let left = prev;
      if (
        prevRun && tailRun &&
        prevRun[0].length > 0 &&
        tailRun[0].length > 0 &&
        prevRun[0][0] === tailRun[0][0]
      ) {
        left = prev.slice(0, prev.length - prevRun[0].length);
      }

      const needSpace = left && /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(tail);
      return needSpace ? (left + ' ' + tail) : (left + tail);
    }

    // Fallback: pick the one with more info (normalized length), but keep original text
    return nc.length >= np.length ? curr : prev;
  };

  Speech.onSpeechStart = async () => {
    console.log('Speech started');
  };

  Speech.onSpeechEnd = async () => {
    console.log('***Sentence ended***:', lastTranscript);
    if (lastTranscript == '') {
      return;
    }
    //Speech.speak(lastTranscript, 0);
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
        // Android path
    const merged = mergeSmartKeepPunct(lastTranscript, curr, 2);
    if (merged === lastTranscript) return; // no new info

    lastTranscript = merged;
    console.log('Partial:', merged);

    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      console.log('⏳ Silence timeout reached, speaking:', lastTranscript);
      const newText = lastTranscript.trim();
      if (newText.length > 0) {
        console.log('🗣️ Speaking:', newText);
        await Speech.speak(newText, 0);
        lastProcessed = lastTranscript;
        lastTranscript = '';
      }
      //await Speech.start('en-US');
    }, silenceThresholdMs);
  };

  Speech.onSpeechResults = async (e) => {
    if (Platform.OS === 'android') {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      console.log('Results: ', e.value?.[0]);
      const current = e.value?.[0];
      await Speech.speak(current, 0);
      return;
    }

    console.log('Results: ', e.value?.[0]);
    const current = e.value?.[0];
    if (!current || current === lastTranscript) return;

    const newWords = current.replace(lastTranscript, '').trim();
    console.log('Heard new words:', newWords);

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

  };

  useEffect(() => {
    
    // --> WAKE WORD CALLED ENTRY !!!!
    // *** === keyword callback === ***
    //
    // THIS IS THE PLACE TO PLAY WITH ASR/STT and TTS
    //
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
//        await Speech.initAll({ locale:'en-US', model: 'model2.onnx' }); // Voice of coach Rich
        await Speech.initAll({ locale:'en-US', model: 'model.onnx' }); // Voice of coach Ariana
        console.log('Calling Speech.start');
        const off = Speech.onFinishedSpeaking = () => {
          console.log('✅ Finished speaking (last WAV done).');
        };
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }

      // You can play WAV files without initializing the Speech frameowrk
      await Speech.playWav(moonRocksSound, true);
      // await Speech.speak("245 . 23");
      // await Speech.speak("45 . 223");
      // await Speech.speak("five dot twenty three");
      await Speech.speak("Hi! Welcome to Lunafit! My name is Rich. Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!");

      // await Speech.speak("This is the first, \
      //   react native package with full voice support! \
      //   Luna fitness application is using this package. \
      //   Inside Luna Fitness application you will here things like: \
      //   Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!");

      // setTimeout(async () => {
      //   await Speech.pauseMicrophone();
      //   setTimeout(async () => {
      //     try {
      //       await tts.initTTS({model: 'model2.onnx'});
      //       await tts.speak("five dot twenty three");
      //       await Speech.playWav(moonRocksSound, true);
      //     }
      //     catch (error) {
      //       console.log("Speech.speak RAISE ERROR", error);
      //       console.log("Speech.speak RAISE ERROR", error);
      //       console.log("Speech.speak RAISE ERROR", error);
      //       console.log("Speech.speak RAISE ERROR", error);
      //       console.log("Speech.speak RAISE ERROR", error);
      //     }
      //   }, 300);
      // }, 30000);
      // setTimeout(async () => {
      //   await Speech.unPauseMicrophone();
      // }, 100000);
      //  Restart detection after timeout
      setTimeout(async () => {
        console.log('Restarting wake word');
        setMessage(`Listening to WakeWords '${wakeWords}'...`);
        setIsFlashing(false);

        await Speech.destroyAll();

        if (Platform.OS === 'android') {
          await sleep(300);
        }

        // re-attach listener then start detection
        await attachListenerOnce(instance, keywordCallback);
        await instance.startKeywordDetection(instanceConfigs[0].threshold, true);
      }, 20000);
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

    // ************ INIT **************
    // --> STARTING POINT - INIT OF KEYWORD DETECTION !!!!
    const initializeKeywordDetection = async () => {
      try {
        // 🔹 *** NEW ***: configure routing once (iOS only) BEFORE creating instances
        if (Platform.OS === 'ios') {
          try {
            await setWakewordAudioRoutingConfig(defaultAudioRoutingConfig);
          } catch (e) {
            console.warn('setWakewordAudioRoutingConfig failed (ignored):', e);
          }
        }

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
          'MTc2NzEzMjAwMDAwMA==-05jR9f/gn4F/SyNwjbdLHIfTaCJK4VYdikxSVxAJcDk='
        );

        /* Below code with enableDucking/disableDucking and startKeywordDetection(xxx, false, ...) - where
        false is the second argument is used to initialze other audio sessions before wake word to duck others etc'
        You can aslo make wake word use the same settings and not chaning audio session.
        // await disableDucking();
        // await enableDucking();
        // await inst.startKeywordDetection(instanceConfigs[0].threshold, false);
        */
        await inst.startKeywordDetection(instanceConfigs[0].threshold, true);
        //await disableDucking();

        if (!isLicensed) {
          console.error('No License!!! - setKeywordDetectionLicense returned', isLicensed);
        }

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
