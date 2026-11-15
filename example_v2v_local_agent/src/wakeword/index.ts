import RNFS from 'react-native-fs';
import { Alert, NativeModules, Platform, Share } from 'react-native';
import type SpeechType from 'react-native-davoice/speech';
import type { AudioRoutingConfig as SpeechAudioRoutingConfig } from 'react-native-davoice/speech';
import { disableDucking, enableDucking, createKeyWordRNBridgeInstance, setWakewordAudioRoutingConfig } from 'react-native-wakeword';
import type { AudioRoutingConfig, KeyWordRNBridgeInstance } from 'react-native-wakeword';
import type { AppModeChoice } from '../appflow';
import { ensureMicPermission } from '../initialization';

//
//
// --> *** IMPORTANT IOS AUDIO SESSION CONFIG ***
// Set Audio session for IOS!!!!
//
//
type AppPreferredAudioInput = 'bluetoothHighQualityMic' | 'builtInMic' | 'none';
type AppAudioRoutingOption =
  | AudioRoutingConfig['default']['options'][number]
  | 'allowBluetoothHFP'
  | 'bluetoothHighQualityRecording';
type AppRouteConfigEntry = Omit<AudioRoutingConfig['default'], 'options' | 'preferredInput'> & {
  options: AppAudioRoutingOption[];
  preferredInput: AppPreferredAudioInput;
  forceFallback?: AppPreferredAudioInput;
  forceFallback1?: AppPreferredAudioInput;
  forceFallback2?: AppPreferredAudioInput;
  preferredInputFallback?: AppPreferredAudioInput;
  preferredInputFallback1?: AppPreferredAudioInput;
  preferredInputFallback2?: AppPreferredAudioInput;
  notifyOthers?: boolean;
};
type AppAudioRoutingConfig = {
  default: AppRouteConfigEntry;
  byOutputPort: {
    [Port in keyof AudioRoutingConfig['byOutputPort']]?: AppRouteConfigEntry;
  };
  WhenPlayingAudio?: {
    onPlay?: Pick<AppRouteConfigEntry, 'options'>;
    onFinishPlaying?: Pick<AppRouteConfigEntry, 'notifyOthers'>;
    msBeforeUnduck?: number;
  };
  STTDuckingConfig?: {
    onUnpause?: Pick<AppRouteConfigEntry, 'options'>;
    onPause?: Pick<AppRouteConfigEntry, 'notifyOthers'>;
    msBeforeUnduck?: number;
  };
  wakeWordDuringTTS?: {
    threshold: number;
    buffer_cnt: number;
  };
  // App-wide AEC (STT, wake word and TTS). When present it replaces
  // WakewordAEC. 'always' keeps AEC on whenever STT or wake word listens;
  // 'duringTTS' only while TTS plays.
  AEC?: {
    mode: 'off' | 'duringTTS' | 'always';
  };
  WakewordAEC?: {
    regular: boolean;
    duringTTS: boolean;
  };
};

export const defaultAudioRoutingConfig: AppAudioRoutingConfig = {
  WakewordAEC: {
    regular: false,
    duringTTS: false,
  },
  // Fallback when no special port matches. Native adds A2DP for the primary
  // Apple HD-mic attempt and switches to ordinary HFP if HD verification fails.
  default: {
    category: 'playAndRecord',
    mode: 'default',
    options: [
      'mixWithOthers',
      'bluetoothHighQualityRecording',
      'allowAirPlay',
      'defaultToSpeaker',
    ],
    preferredInput: 'bluetoothHighQualityMic',
    forceFallback: 'none',
  },
  byOutputPort: {
    // 1. CarPlay: run in CarPlay
    carAudio: {
      category: 'playAndRecord',
      mode: 'default',
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
      mode: 'default',
      options: [
        'mixWithOthers',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'defaultToSpeaker',
      ],
      preferredInput: 'builtInMic',
    },

    // ✅ NEW: when we’re already on built-in speaker, keep SAME config
    builtInSpeaker: {
      category: 'playAndRecord',
      mode: 'default',
      options: [
        'mixWithOthers',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'defaultToSpeaker',
      ],
      preferredInput: 'builtInMic',
    },

    // 3. Bluetooth A2DP: try the HD headset mic; fall back to ordinary HFP.
    bluetoothA2DP: {
      category: 'playAndRecord',
      mode: 'default',
      options: [
        'mixWithOthers',
        'bluetoothHighQualityRecording',
        'allowAirPlay',
      ],
      preferredInput: 'bluetoothHighQualityMic',
      forceFallback: 'none',
    },

    // 4. Try to upgrade HFP to HD recording; if unavailable, use ordinary HFP.
    bluetoothHFP: {
      category: 'playAndRecord',
      mode: 'default',
      options: [
        'mixWithOthers',
        'bluetoothHighQualityRecording',
        'allowAirPlay',
      ],
      preferredInput: 'bluetoothHighQualityMic',
      forceFallback: 'none',
    },

    // 5. Wired headphones – play in ears, mic from phone
    headphones: {
      category: 'playAndRecord',
      mode: 'default',
      options: [
        'mixWithOthers',
        'allowBluetoothA2DP',
        'allowAirPlay',
      ],
      preferredInput: 'builtInMic',
    },
  },
  WhenPlayingAudio: {
    // Native clones the current hardware route and adds only duckOthers.
    onPlay: {
      options: ['duckOthers'],
    },

    // Native code notifies other audio and then restores the regular route.
    onFinishPlaying: {
      notifyOthers: true,
    },
  },
  STTDuckingConfig: {
    // Native clones the current hardware route and adds only duckOthers.
    onUnpause: {
      options: ['duckOthers'],
    },

    // When STT pauses and playback is also idle, notify and restore the route.
    onPause: {
      notifyOthers: true,
    },
  },
  wakeWordDuringTTS: {
    threshold: 0.9,
    buffer_cnt: 1,
  },
};

export interface InstanceConfig {
  id: string;
  modelName: string;
  threshold: number;
  bufferCnt: number;
  sticky: boolean;
  msBetweenCallbacks: number;
}
// export const modelName = 'ayuda_model_28_05022026.dm';
// //const modelName = 'hey_lookdeep' + (Platform.OS === 'ios' ? '.onnx' : '.dm');
// //const modelName = 'ayuda_model_28_05022026' + (Platform.OS === 'ios' ? '.onnx' : '.dm');
// // Create an array of instance configurations
// export const instanceConfigs: InstanceConfig[] = [
//   { id: 'multi_model_instance', modelName, threshold: 0.9, bufferCnt: 2, sticky: false, msBetweenCallbacks: 1000 },
//   // Ayuda:
//   //   { id: 'multi_model_instance', modelName, threshold: 0.95, bufferCnt: 3, sticky: false, msBetweenCallbacks: 1000 },
// ];


export const modelName = 'hey_coach_model_28_22012026b.dm';
//const modelName = 'hey_lookdeep' + (Platform.OS === 'ios' ? '.onnx' : '.dm');
//const modelName = 'ayuda_model_28_05022026' + (Platform.OS === 'ios' ? '.onnx' : '.dm');
// Create an array of instance configurations
export const instanceConfigs: InstanceConfig[] = [
  { id: 'multi_model_instance', modelName, threshold: 0.999, bufferCnt: 3, sticky: false, msBetweenCallbacks: 1000 },
  // Ayuda:
  //   { id: 'multi_model_instance', modelName, threshold: 0.95, bufferCnt: 3, sticky: false, msBetweenCallbacks: 1000 },
];

// Helper function to format the ONNX file name
export const formatWakeWord = (fileName: string) => {
    return fileName
      .replace(/(_model.*|_\d+.*)(\.(onnx|dm))$/, '')
      .replace(/\.(onnx|dm)$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const AudioPermissionComponent = async () => {
  return ensureMicPermission();
};

// --- instance creation (kept exactly as in your code) ---
export async function addInstance(conf: InstanceConfig): Promise<KeyWordRNBridgeInstance> {
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

export async function addInstanceMulti(conf: InstanceConfig): Promise<KeyWordRNBridgeInstance> {
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

export async function attachKeywordListenerOnce(
  listenerRef: { current: any },
  instance: KeyWordRNBridgeInstance,
  formatPhrase: (phrase: string) => string,
  callback: (phrase: string) => void,
) {
  const curr = listenerRef.current;
  if (curr && typeof curr.remove === 'function') {
    try {
      await curr.remove();
    } catch (e) {
      console.warn('listener.remove failed (ignored):', e);
    }
  }
  listenerRef.current = null;

  const sub = instance.onKeywordDetectionEvent((phrase: string) => {
    const nice = formatPhrase(phrase);
    console.log(`Instance ${instance.instanceId} detected: ${nice} with phrase`, nice);
    callback(nice);
  });
  console.log('eventListener == ', sub);
  listenerRef.current = sub;
  return sub;
}

export async function detachKeywordListener(listenerRef: { current: any }) {
  const curr = listenerRef.current;
  if (curr && typeof curr.remove === 'function') {
    try {
      await curr.remove();
    } catch (e) {
      console.warn('listener.remove failed (ignored):', e);
    }
  }
  listenerRef.current = null;
}

export async function startWakewordDetection({
  instance,
  svChoice,
  enrollmentJsonPath,
  sleep,
}: {
  instance: KeyWordRNBridgeInstance;
  svChoice: string;
  enrollmentJsonPath?: string | null;
  sleep: (ms: number) => Promise<void>;
}) {
  /* Below code with enableDucking/disableDucking and startKeywordDetection(xxx, false, ...) - where
  false is the second argument is used to initialze other audio sessions before wake word to duck others etc'
  You can aslo make wake word use the same settings and not chaning audio session.
  // await disableDucking();
  // await enableDucking();
  // await inst.startKeywordDetection(instanceConfigs[0].threshold, false);
  */

  try {
    await instance.stopKeywordDetection();
  } catch {}

  if (svChoice !== 'skip' && typeof enrollmentJsonPath === 'string' && enrollmentJsonPath.length > 0) {
    console.log('startKeywordDetection with SV:', enrollmentJsonPath);
    await instance.startKeywordDetection(
      instanceConfigs[0].threshold,
      enrollmentJsonPath || '',
      true,
    );
  } else {
    console.log('startKeywordDetection without SV:');
    await instance.startKeywordDetection(instanceConfigs[0].threshold, true);
  }
  await instance.pauseDetection(false);//Platform.OS === 'android' ? true : false);
  await sleep(100);
  console.log('Post pauseDetection');
}

export async function resumeWakewordDetection(instance: KeyWordRNBridgeInstance) {
  try {
    console.log('calling unPauseDetection after speech init path');
    await instance.unPauseDetection();
    console.log('Post pauseDetection 3');
  } catch (unpauseError) {
    console.error('Failed to unpause keyword detection:', unpauseError);
  }
}

export async function initializeWakewordBootstrap({
  PlatformOS,
  defaultAudioRoutingConfig,
  setMessage,
  keywordCallback,
  listenerRef,
  myInstanceRef,
  keywordLicense,
  speechLicense,
  Speech,
  svChoice,
  enrollmentJsonPath,
  sleep,
  initializeSpeechLibrary,
  speechInitTimeoutMs = 15000,
  withTimeout,
  suppressAndroidPartialResultsRef,
  speechLibraryInitializedRef,
}: {
  PlatformOS: string;
  defaultAudioRoutingConfig: AppAudioRoutingConfig;
  setMessage: (value: string) => void;
  keywordCallback: (phrase: string) => void;
  listenerRef: { current: any };
  myInstanceRef: { current: KeyWordRNBridgeInstance | null };
  keywordLicense: string;
  speechLicense: string;
  Speech: typeof SpeechType;
  svChoice: string;
  enrollmentJsonPath?: string | null;
  sleep: (ms: number) => Promise<void>;
  initializeSpeechLibrary: (enrollmentJsonPath?: string | null) => Promise<void>;
  speechInitTimeoutMs?: number;
  withTimeout: <T>(promise: Promise<T>, timeoutMs: number, label: string) => Promise<T>;
  suppressAndroidPartialResultsRef: { current: boolean };
  speechLibraryInitializedRef: { current: boolean };
}): Promise<{
  inst?: KeyWordRNBridgeInstance;
  speechInitCompleted: boolean;
  failureReason?: 'model-load' | 'invalid-license' | 'speech-initialization';
}> {
  // 🔹 Configure audio session before creating instances
  try {
    await setWakewordAudioRoutingConfig(defaultAudioRoutingConfig);
  } catch (e) {
    console.warn('setWakewordAudioRoutingConfig failed (ignored):', e);
  }
  try {
    // Set the same routing config directly on STT/TTS before Speech.initAll().
    // Native accepts the temporary sections as deltas over the regular route.
    // The installed speech declaration still models them as full entries.
    await Speech.setAudioRoutingConfig(defaultAudioRoutingConfig as SpeechAudioRoutingConfig);
  } catch (e) {
    console.warn('Speech.setAudioRoutingConfig failed (wakeword fallback will be tried):', e);
  }


  // --> CREATE THE INSTANCE !!!!
  try {
    console.log('Adding element:', instanceConfigs[0]);
    const instance = await addInstanceMulti(instanceConfigs[0]);
    myInstanceRef.current = instance;
  } catch (error) {
    console.error('Error loading model:', error);
    return { speechInitCompleted: false, failureReason: 'model-load' };
  }

  // --> Attach the callback !!!!
  const inst = myInstanceRef.current!;
  await attachKeywordListenerOnce(listenerRef, inst, formatWakeWord, keywordCallback);

  const isLicensed = await inst.setKeywordDetectionLicense(keywordLicense);
  if (!isLicensed) {
    console.error('No License!!! - setKeywordDetectionLicense returned', isLicensed);
    setMessage('License not valid: Please contact info@davoice.io for a new license');
    return { speechInitCompleted: false, failureReason: 'invalid-license' };
  }

  const isSpeechLicensed = await Speech.setLicense(speechLicense);
  if (!isSpeechLicensed) {
    console.error('No License!!! - Speech.setLicense returned', isSpeechLicensed);
    setMessage('License not valid: Please contact info@davoice.io for a new license');
    return { speechInitCompleted: false, failureReason: 'invalid-license' };
  }

  await startWakewordDetection({
    instance: inst,
    svChoice,
    enrollmentJsonPath,
    sleep,
  });

  let speechInitCompleted = false;
  try {
    suppressAndroidPartialResultsRef.current = true;
    setMessage('Initializing speech engine...');
    console.log('Before initializeSpeechLibrary');
    await withTimeout(
      initializeSpeechLibrary(
        typeof enrollmentJsonPath === 'string' && enrollmentJsonPath.length > 0
          ? enrollmentJsonPath
          : null,
      ),
      speechInitTimeoutMs,
      'Speech.initAll',
    );
    speechLibraryInitializedRef.current = true;
    speechInitCompleted = true;
    console.log('After initializeSpeechLibrary');
    if (Platform.OS !== 'android') {
      await sleep(1000);
    }

    try {
      await Speech.pauseSpeechRecognition();
    } catch (e) {
      console.warn('Initial pauseSpeechRecognition failed (ignored):', e);
    } finally {
      suppressAndroidPartialResultsRef.current = false;
    }
    // console.log('Post pauseDetection 2');
  } catch (e) {
    suppressAndroidPartialResultsRef.current = false;
    speechLibraryInitializedRef.current = false;
    console.error('Speech initialization failed or hung:', e);
    setMessage('Speech init stalled. Wakeword detection was resumed, but speech may need a retry.');
  } finally {
    await resumeWakewordDetection(inst);
  }

  return {
    inst,
    speechInitCompleted,
    failureReason: speechInitCompleted ? undefined : 'speech-initialization',
  };
}

const toFileUrl = (path: string): string => (path.startsWith('file://') ? path : `file://${path}`);

export async function shareWakewordRecordings({
  latestWakewordRecordingPaths,
  setIsMenuOpen,
}: {
  latestWakewordRecordingPaths: string[];
  setIsMenuOpen: (value: boolean) => void;
}) {
  setIsMenuOpen(false);

  if (latestWakewordRecordingPaths.length === 0) {
    Alert.alert('No recordings', 'No wake-word recordings are available yet.');
    return;
  }

  const existingPaths: string[] = [];
  for (const path of latestWakewordRecordingPaths) {
    try {
      if (await RNFS.exists(path)) existingPaths.push(path);
    } catch { }
  }

  if (existingPaths.length === 0) {
    Alert.alert('Missing files', 'Recorded files were not found on disk.');
    return;
  }

  if (Platform.OS === 'android') {
    const nativeShare = NativeModules.WakewordRecordingShare as
      | { shareRecordings: (paths: string[], title?: string) => Promise<boolean> }
      | undefined;
    if (!nativeShare?.shareRecordings) {
      Alert.alert('Share unavailable', 'Native share module is not available in this build.');
      return;
    }
    await nativeShare.shareRecordings(existingPaths, 'Share wake-word recordings');
    return;
  }

  if (Platform.OS === 'ios') {
    const lastPath = existingPaths[existingPaths.length - 1];
    await Share.share({
      title: 'Share wake-word recording',
      url: toFileUrl(lastPath),
    });
    return;
  }
}

export async function prepareWakewordSpeechSession({
  isFirstCall,
  enrollmentJsonRef,
  setShowSVPrompt,
  setSvRunning,
  svElapsedIntervalRef,
  setAppModeChoice,
  setSpeechSessionUIActive,
  clearSpeechSentenceUI,
  Speech,
  setShowAppModePrompt,
  appModeChoiceResolverRef,
  selectedAppModeRef,
  waitForIdle,
  setCurrentSpeechSentence,
  setIsSpeakerIdentificationActive,
  speechLibraryInitializedRef,
  speakModeSelectionNarration,
}: any) {
  let enrollmentJson = enrollmentJsonRef.current;
  {
    console.log('[keywordCallback] Moving past SV onboarding');
    setShowSVPrompt(false);
    setSvRunning(false);
    if (svElapsedIntervalRef.current) {
      clearInterval(svElapsedIntervalRef.current);
      svElapsedIntervalRef.current = null;
    }
  }
  if (isFirstCall) {
    setAppModeChoice('local_ai_chat');
    setSpeechSessionUIActive(false);
    clearSpeechSentenceUI();
    try {
      await Speech.pauseSpeechRecognition();
    } catch (error) {
      console.log('[AppMode] failed to pause speech recognition before mode prompt:', error);
    }
    if (typeof speakModeSelectionNarration === 'function') {
      await speakModeSelectionNarration();
    }
    setShowAppModePrompt(true);
    const selectedModeChoice = await new Promise<AppModeChoice>((resolve) => {
      appModeChoiceResolverRef.current = resolve;
    });
    setShowAppModePrompt(false);
    selectedAppModeRef.current = selectedModeChoice;
    await waitForIdle();
  }

  // await Speech.destroyAll();
  // await sleep(300);

  setSpeechSessionUIActive(false);
  setCurrentSpeechSentence('');
  enrollmentJson = enrollmentJsonRef.current ?? enrollmentJson;
  setIsSpeakerIdentificationActive(typeof enrollmentJson === 'string' && enrollmentJson.length > 0);
  console.log('[keywordCallback] Speech already initialized');
  if (!speechLibraryInitializedRef.current) {
    console.warn('[keywordCallback] Speech library was not initialized during startup.');
  }

  return enrollmentJson;
}

export async function captureWakewordDetection({
  instance,
  stopWakeWord,
  sleep,
  setLatestWakewordRecordingPaths,
}: any) {
  let wavFilePath = '';
  let recordedWavPaths: string[] = [];

  // 2) Stop Detection (native)
  try {
    if (stopWakeWord) {
      await instance.stopKeywordDetection(/* FR add if stop microphone or */);
    } else {
      await instance.pauseDetection(false);//Platform.OS === 'android' ? true : false);
    }

    wavFilePath = await instance.getRecordingWav();
    if (Platform.OS === 'android') {
      recordedWavPaths = await instance.getRecordingWavArray();
    }
    console.log('paths == ', recordedWavPaths);
  } catch {}

  const pathsForSharing =
    Platform.OS === 'android'
      ? (recordedWavPaths.length > 0 ? recordedWavPaths : [wavFilePath]).filter(Boolean)
      : [wavFilePath].filter(Boolean);
  if (pathsForSharing.length > 0) {
    setLatestWakewordRecordingPaths(pathsForSharing);
  }
  await sleep(1000);

  return { wavFilePath, recordedWavPaths, pathsForSharing };
}

export function cleanDetectedWakeWord(keywordIndex: any) {
  console.log('detected keyword: ', keywordIndex);
  const keywordText = String(keywordIndex ?? '');
  const keywordWords = keywordText.trim().split(/\s+/).filter(Boolean);
  const modelWordIndex = keywordWords.findIndex((w) => w.toLowerCase() === 'model');
  const cleanWakeWord =
    modelWordIndex >= 0
      ? keywordWords.slice(0, modelWordIndex).join(' ')
      : keywordText;
  return { keywordText, keywordWords, cleanWakeWord };
}
