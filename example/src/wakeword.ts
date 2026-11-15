/**
 * Wake word detection with react-native-wakeword.
 *
 *   createWakewordDetector()  - creates the native instance, loads the model, applies the license
 *   startListening()          - starts detection; with a voice profile only the enrolled speaker wakes the app
 *   stopListening()           - stops detection (do this before enrolling or testing a voice: one microphone user at a time)
 */
import { Platform } from 'react-native';
import {
  createKeyWordRNBridgeInstance,
  requestIOSMicPermissions,
  hasIOSMicPermissions,
  setWakewordAudioRoutingConfig,
} from 'react-native-wakeword';
import type { AudioRoutingConfig, KeyWordRNBridgeInstance } from 'react-native-wakeword';
import { PermissionsAndroid } from 'react-native';
import {
  DAVOICE_LICENSE,
  WAKEWORD_BUFFER_COUNT,
  WAKEWORD_MODEL,
  WAKEWORD_MS_BETWEEN_CALLBACKS,
  WAKEWORD_THRESHOLD,
} from './config';

/**
 * iOS audio session for an always-listening app: record and play together, mix with other apps' audio,
 * prefer a Bluetooth headset microphone when one is connected, keep playback on the speaker.
 * (Android ignores the iOS-specific parts.)
 */
const audioRoutingConfig = {
  WakewordAEC: { regular: false, duringTTS: false },
  default: {
    category: 'playAndRecord',
    mode: 'default',
    options: ['mixWithOthers', 'bluetoothHighQualityRecording', 'allowAirPlay', 'defaultToSpeaker'],
    preferredInput: 'bluetoothHighQualityMic',
    forceFallback: 'none',
  },
  byOutputPort: {
    carAudio: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay', 'overrideMutedMicrophoneInterruption'],
      preferredInput: 'none', // the car's microphone
    },
    builtInReceiver: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'allowBluetoothA2DP', 'allowAirPlay', 'defaultToSpeaker'],
      preferredInput: 'builtInMic',
    },
    builtInSpeaker: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'allowBluetoothA2DP', 'allowAirPlay', 'defaultToSpeaker'],
      preferredInput: 'builtInMic',
    },
    bluetoothA2DP: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'bluetoothHighQualityRecording', 'allowAirPlay'],
      preferredInput: 'bluetoothHighQualityMic',
      forceFallback: 'none',
    },
    bluetoothHFP: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'bluetoothHighQualityRecording', 'allowAirPlay'],
      preferredInput: 'bluetoothHighQualityMic',
      forceFallback: 'none',
    },
    headphones: {
      category: 'playAndRecord',
      mode: 'default',
      options: ['mixWithOthers', 'allowBluetoothA2DP', 'allowAirPlay'],
      preferredInput: 'builtInMic',
    },
  },
} as unknown as AudioRoutingConfig;

export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  if (await hasIOSMicPermissions()) return true;
  return !!(await requestIOSMicPermissions(20000));
}

export type WakewordDetector = {
  instance: KeyWordRNBridgeInstance;
  remove: () => Promise<void>;
};

/**
 * Creates the detector for `modelPath` (a bundled model's file name, or an absolute path to a downloaded model)
 * and calls `onDetected` on every detection. Throws when the model can't be loaded or the license is rejected.
 */
export async function createWakewordDetector(
  modelPath: string = WAKEWORD_MODEL,
  onDetected: (event: unknown) => void,
): Promise<WakewordDetector> {
  try {
    await setWakewordAudioRoutingConfig(audioRoutingConfig);
  } catch (e) {
    console.warn('[Wakeword] setWakewordAudioRoutingConfig failed (ignored):', e);
  }
  const instance = await createKeyWordRNBridgeInstance('wakeword', false);
  // One instance can listen for several models at once: pass one entry per model.
  await instance.createInstanceMulti([modelPath], [WAKEWORD_THRESHOLD], [WAKEWORD_BUFFER_COUNT], [WAKEWORD_MS_BETWEEN_CALLBACKS]);
  const subscription = instance.onKeywordDetectionEvent((event: unknown) => onDetected(event));
  const licensed = await instance.setKeywordDetectionLicense(DAVOICE_LICENSE);
  if (!licensed) {
    subscription.remove();
    await instance.destroyInstance().catch(() => {});
    throw new Error('The DaVoice license was rejected (expired?). Contact info@davoice.io.');
  }
  return {
    instance,
    remove: async () => {
      subscription.remove();
      await instance.stopKeywordDetection().catch(() => {});
      await instance.destroyInstance().catch(() => {});
    },
  };
}

/**
 * Starts listening. With `voiceProfilePath` (a saved speaker verification enrollment) the detection is gated
 * natively: only the enrolled speaker saying the wake word triggers `onDetected`.
 */
export async function startListening(instance: KeyWordRNBridgeInstance, voiceProfilePath: string | null) {
  await instance.stopKeywordDetection().catch(() => {});
  if (voiceProfilePath) {
    await instance.startKeywordDetection(WAKEWORD_THRESHOLD, voiceProfilePath, true);
  } else {
    await instance.startKeywordDetection(WAKEWORD_THRESHOLD, true);
  }
}

export async function stopListening(instance: KeyWordRNBridgeInstance) {
  await instance.stopKeywordDetection().catch(() => {});
}

/** A readable name for a detection event ("hey_coach_model_28_22012026b" -> "Hey Coach"). */
export function detectionLabel(event: unknown): string {
  const raw = typeof event === 'string' ? event : String((event as any)?.phrase ?? (event as any)?.keyword ?? JSON.stringify(event));
  return raw
    .replace(/^.*\//, '')
    .replace(/(_model.*|_\d+.*)?(\.(onnx|dm))?$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
