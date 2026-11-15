import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import type SpeechType from 'react-native-davoice/speech';
import type { TTSVoiceChoice } from '../appflow';

// Yield between UI transitions and speech operations, without waiting indefinitely.
export const waitForIdle = () =>
  new Promise<void>((resolve) => {
    requestIdleCallback(() => resolve(), { timeout: 250 });
  });

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

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
    /*   // iOS: request explicitly
       const mic = await check(PERMISSIONS.IOS.MICROPHONE);
       if (mic === RESULTS.GRANTED) return true;

       if (mic === RESULTS.BLOCKED) {
         Alert.alert('Microphone permission required', 'Enable it in Settings.', [
           { text: 'Open Settings', onPress: () => openSettings() },
           { text: 'Cancel', style: 'cancel' },
         ]);
         return false;
       }

       const micReq = await request(PERMISSIONS.IOS.MICROPHONE);
       if (micReq !== RESULTS.GRANTED) return false;

       // Optional but usually needed for dictation/STT APIs:
       const sr = await check(PERMISSIONS.IOS.SPEECH_RECOGNITION);
       if (sr === RESULTS.GRANTED) return true;

       const srReq = await request(PERMISSIONS.IOS.SPEECH_RECOGNITION);
       return srReq === RESULTS.GRANTED;*/
    return true;
  }
}

export async function initializeSpeechLibrary(
  Speech: typeof SpeechType,
  selectedTTSModel: any,
  enrollmentJsonPath?: string | null,
  speakerId?: string,
  locale = 'en-US',
) {
  // Suppress STT beeps during model loading by pausing before initAll starts.
  if (Platform.OS === 'android') {
    try { await Speech.pauseSpeechRecognition(); } catch {}
  }

  console.log('Calling Speech.initAll');
  if (typeof enrollmentJsonPath === 'string' && enrollmentJsonPath.length > 0) {
    console.log('Calling Speech.initAll with enrollmentJson:', enrollmentJsonPath);
    await Speech.initAll({
      locale,
      model: selectedTTSModel,
      onboardingJsonPath: enrollmentJsonPath,
      speakerId,
    });
  } else {
    console.log('Calling Speech.initAll WITHOUT');
    await Speech.initAll({ locale, model: selectedTTSModel });
  }

    try { await Speech.pauseSpeechRecognition(); } catch {}
}

export async function promptForTTSModelChoice({
  setShowTTSModelPrompt,
  ttsModelChoiceResolverRef,
  setTtsVoiceChoice,
  waitForIdle,
}: {
  setShowTTSModelPrompt: (value: boolean) => void;
  ttsModelChoiceResolverRef: { current: null | ((choice: { voice: TTSVoiceChoice }) => void) };
  setTtsVoiceChoice: (value: TTSVoiceChoice) => void;
  waitForIdle: () => Promise<void>;
}) {
  setShowTTSModelPrompt(true);
  const choice = await new Promise<{ voice: TTSVoiceChoice }>((resolve) => {
    ttsModelChoiceResolverRef.current = resolve;
  });
  setShowTTSModelPrompt(false);
  setTtsVoiceChoice(choice.voice);
  await waitForIdle();
  return choice;
}
