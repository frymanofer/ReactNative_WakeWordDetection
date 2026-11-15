// Below is a part of Speech Feature to play mp3 and WAV file within the same Audio framework.
// You call Speech.playWav with any mp3/wav etc' file you need

export const ARIANA = 0;
export const RICH = 1;

export const SPEAKER = 0;

export const RICH_SPEAKER_SPEED = 0.85;
export const ARIANA_SPEAKER_SPEED = 0.88; //0.75;
export const HANNA_SPEAKER_SPEED = 0.9;

export const RICH_SPEAKER_SPEED_NEW_MODEL = 0.95;
export const ARIANA_SPEAKER_SPEED_NEW_MODEL = 1.0;
export const HANNA_SPEAKER_SPEED_NEW_MODEL = 1.0;
export const KATE_SPEAKER_SPEED_NEW_MODEL = 1.0;
export const CLONED_VOICE_SPEED = 1.0;

// const SPEAKER_SPEED = ARIANA_SPEAKER_SPEED;
//const SPEAKER_SPEED = 0.75;
// const SPEAKER_SPEED_ = 0.85;
//export const SPEAKER_SPEED = 0.9;// 0.85;
export const SPEAKER_SPEED = 1.0;// 0.85;

export const moonRocksSound = require('../../assets/cashRegisterSound.mp3');
export const subtractMoonRocksSound = require('../../assets/bellServiceDeskPressXThree.mp3');

import type { AppLanguage, BundledTTSVoice, TTSVoiceChoice } from '../appflow';
import { narrationFor } from '../narration';
import { languagePackFilePath } from './languagePacks';
import { BUNDLED_LANGUAGE_FILES } from './languagePacks.generated';

// Which languages are built into the app (default English + Brazilian Portuguese) and which are downloaded
// as language packs: language_packs.json -> languagePacks.generated.ts (BUNDLED_LANGUAGE_FILES holds the
// require()s; see src/tts/languagePacks.ts). A language's voice-cloning embedder must match its model. Each language keeps its own
// configured embedder FILE, even when the weights are identical (pt-PT's embedder_pt_pt.dm is a copy of pt-BR's embedder_brv1.dm since
// the 2026-11-12 pt-PT model): one language can change without touching another. A v1 embedder (da/sv/el) fits only its own v1 model.
// Hebrew is in neither (hidden; its TTS v1 base voice is non-commercial, never ship or upload it): to bring
// it back, add it to the JSON with model_v1_hebrew.dm + embedder_he.dm and remove `hidden` in src/appflow.ts.

// pt-BR / pt-PT speaking speed (restored 2026-11-12: lost in the language-pack change, which made every non-English voice throw).
const BRAZILIAN_SPEAKER_SPEED = 1.0;

// The bundled file, else the downloaded language pack's file, else English (the app downloads the pack
// before it selects the language, so the fallback means a hidden language like he, or a missing pack).
function languageFile(kind: 'model' | 'embedder', language: AppLanguage): any {
  const file = BUNDLED_LANGUAGE_FILES[language]?.[kind] ?? languagePackFilePath(language, kind);
  if (file == null) {
    console.warn(`[tts] no ${kind} for ${language} (not bundled, language pack not downloaded): using English`);
    return BUNDLED_LANGUAGE_FILES.en?.[kind] ?? languagePackFilePath('en', kind);
  }
  return file;
}

// The app's language (the language screen sets it before the speech library loads).
let ttsLanguage: AppLanguage = 'en';
export function setTTSLanguage(language: AppLanguage) {
  ttsLanguage = language;
}
export function getTTSLanguage(): AppLanguage {
  return ttsLanguage;
}
export function getVoiceEmbedder() {
  return languageFile('embedder', ttsLanguage);
}

export function getTTSVoiceConfig(voice: TTSVoiceChoice, useTTS2Only: boolean) {
  const model = languageFile('model', ttsLanguage);
  // Every voice, including a cloned voice, belongs to the selected language model.
  if (ttsLanguage !== 'en') {
    return { model, speed: ttsLanguage === 'pt-BR' || ttsLanguage === 'pt-PT' ? BRAZILIAN_SPEAKER_SPEED : CLONED_VOICE_SPEED, usesTTS2: true };
  }
  if (useTTS2Only) {
    const speeds: Record<BundledTTSVoice, number> = {
      Ariana: ARIANA_SPEAKER_SPEED_NEW_MODEL,
      Rich: RICH_SPEAKER_SPEED_NEW_MODEL,
      Hanna: HANNA_SPEAKER_SPEED_NEW_MODEL,
      Kate: KATE_SPEAKER_SPEED_NEW_MODEL,
      Jenny: KATE_SPEAKER_SPEED_NEW_MODEL,
      Matthew: KATE_SPEAKER_SPEED_NEW_MODEL,
      Gloria: KATE_SPEAKER_SPEED_NEW_MODEL,
    };
    return { model, speed: speeds[voice as BundledTTSVoice] ?? CLONED_VOICE_SPEED, usesTTS2: true };
  }
  const voices: Record<BundledTTSVoice, { model: any; speed: number; usesTTS2: boolean }> = {
    Rich: { model, speed: RICH_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    Kate: { model, speed: KATE_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    Jenny: { model, speed: KATE_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    Matthew: { model, speed: KATE_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    Gloria: { model, speed: KATE_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    // Every voice is a speaker of the shared model.
    Ariana: { model, speed: ARIANA_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
    Hanna: { model, speed: HANNA_SPEAKER_SPEED_NEW_MODEL, usesTTS2: true },
  };
  // A cloned voice (an .emd in the cloned voices folder) is a voice of the shared model too.
  return voices[voice as BundledTTSVoice] ?? { model, speed: CLONED_VOICE_SPEED, usesTTS2: true };
}

export async function playWakewordIntroSpeech({
  Speech,
  speakText,
  beginSpeechUiEpoch,
  setMessageGuarded,
  setIntroSpeakerName,
  setIntroScript,
  setCurrentSpeechSentenceGuarded,
  setIntroSpeakingGuarded,
  selectedSpeakerName,
  getSelectedSpeakerSpeed,
  SPEAKER,
  waitForIdle,
  resetSpeechTranscriptState,
  sleep,
  clearSpeechSentenceUI,
}: any) {
  const speak = speakText ?? Speech.speak.bind(Speech);
  const speechUiEpoch = beginSpeechUiEpoch();
  await Speech.pauseSpeechRecognition();
  const introLine = narrationFor(ttsLanguage).introduction(String(selectedSpeakerName))[0];
  // setMessageGuarded(speechUiEpoch, `${selectedSpeakerName} is speaking...`);
  // setIntroSpeakerName(selectedSpeakerName);
  // setIntroScript(introLine);
  // setCurrentSpeechSentenceGuarded(speechUiEpoch, "Into Message: " + introLine);
  // setIntroSpeakingGuarded(speechUiEpoch, true);

  // try {
  //   await Speech.speak(introLine, SPEAKER, getSelectedSpeakerSpeed());
  // } finally {
  //   setIntroSpeakingGuarded(speechUiEpoch, false);
  // }
  // console.log('[STT_UNPAUSE_TRACE] before Speech.unPauseSpeechRecognition(-1) after intro speech');
  // await Speech.unPauseSpeechRecognition(-1);
  // console.log('[STT_UNPAUSE_TRACE] after Speech.unPauseSpeechRecognition(-1) after intro speech');

  // Hi! Welcome to Lunafit! My name is Ariana. Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!
  // Hi, Welcome to Lunafit, My name is Ariana, Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals, It's about owning your journey!
  /*
  await speak("Hi, Welcome to Lunafit, My name is Ariana, Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals, It's about owning your journey!");
  await speak("Hello, as an AI , I don't have feelings , but I'm here and ready to help you with anything you need. Today, how can I assist you?", SPEAKER, SPEAKER_SPEED);
  await speak("let me demonstrate. Are you ready.", SPEAKER, SPEAKER_SPEED);
  await speak("Hey, how are you?", SPEAKER, SPEAKER_SPEED);
  await speak("Hi guys, how are you?", SPEAKER, SPEAKER_SPEED);
  await speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED);
  await speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED);
  await speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED);
*/
  /*      await Speech.speak("Hello, how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello, how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello, how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello, how are you?", SPEAKER, SPEAKER_SPEED * 0.3);
  await Speech.speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello. how are you?", SPEAKER, SPEAKER_SPEED * 0.3);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.5);
  await Speech.speak("Hello! how are you?", SPEAKER, SPEAKER_SPEED * 0.3);
  await Speech.speak("Hello good people, how are you?", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you?", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you?", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you?", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you?", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  await Speech.speak("Hello good people, how are you.", SPEAKER, SPEAKER_SPEED * 0.8);
  */
  await waitForIdle();
  resetSpeechTranscriptState();
  console.log('[STT_UNPAUSE_TRACE] before Speech.unPauseSpeechRecognition(-1) after waitForIdle');
  await Speech.unPauseSpeechRecognition(-1);
  console.log('[STT_UNPAUSE_TRACE] after Speech.unPauseSpeechRecognition(-1) after waitForIdle');
  await sleep(500);
  clearSpeechSentenceUI(speechUiEpoch);

  return { speechUiEpoch, introLine };
}
