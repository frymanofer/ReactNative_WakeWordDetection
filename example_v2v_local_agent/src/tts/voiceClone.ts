// Voice cloning: turn a short recording (microphone or an audio file) into a
// voice the TTS model can speak with.
//
// Speech.createVoiceClone(audio, `${clonedVoicesPath()}/<Name>.emd`, getVoiceEmbedder())
// writes <Name>.emd; Speech.setExternalVoicesPath(clonedVoicesPath()) makes every
// .emd in the folder a selectable voice (Speech.changeVoice(name)), after the
// voices bundled in the model.

import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import Speech from 'react-native-davoice/speech';
import type { VoiceCloneResult } from 'react-native-davoice/speech';
import { getTTSLanguage, getVoiceEmbedder } from './index';
import type { AppLanguage } from '../appflow';

/**
 * The cloned voices folder of the app's language: new voices are saved here, and
 * the app looks here for cloned voices. One path for both. A voice is made with
 * the language's encoder, so each language has its own folder. Change it to keep
 * voices elsewhere.
 */
export function clonedVoicesPath(): string {
  const base = `${RNFS.DocumentDirectoryPath}/cloned_voices`;
  return getTTSLanguage() === 'en' ? base : `${base}_${getTTSLanguage().replace('-', '_').toLowerCase()}`;
}

/** The microphone recording, before it becomes a voice (replaced each time). */
const RECORDING_PATH = `${RNFS.CachesDirectoryPath}/voice_clone_recording.wav`;

/** How long to record: about 10 seconds of natural speech gives a good voice. */
export const RECOMMENDED_RECORDING_SECONDS = 10;
export const MAX_RECORDING_SECONDS = 30;

/**
 * Voice volume (Speech.createVoiceClone's `volume`), in percent: 100% keeps the
 * recording's loudness, 120% makes the voice 20% louder (volume 1.2), 80% 20%
 * quieter (0.8). The clone screen steps it by VOICE_VOLUME_STEP.
 */
export const DEFAULT_VOICE_VOLUME_PERCENT = 100;
export const MIN_VOICE_VOLUME_PERCENT = 50;
export const MAX_VOICE_VOLUME_PERCENT = 200;
export const VOICE_VOLUME_STEP = 10;

/** A text to read aloud while recording (about 10 seconds). */
const VOICE_CLONE_READING_TEXTS: Record<AppLanguage, string> = {
  en: 'Hello! This is my voice. I am recording a short sample so that my assistant can speak just like me. Today is a good day to try something new.',
  'pt-BR': 'Olá! Esta é a minha voz. Estou gravando uma amostra curta para que meu assistente possa falar como eu. Hoje é um bom dia para experimentar algo novo.',
  'pt-PT': 'Olá! Esta é a minha voz. Estou a gravar uma pequena amostra para que o meu assistente possa falar como eu. Hoje é um bom dia para experimentar algo novo.',
  de: 'Hallo! Das ist meine Stimme. Ich nehme eine kurze Probe auf, damit mein Assistent wie ich sprechen kann. Heute ist ein guter Tag, um etwas Neues auszuprobieren.',
  es: '¡Hola! Esta es mi voz. Estoy grabando una muestra breve para que mi asistente pueda hablar como yo. Hoy es un buen día para probar algo nuevo.',
  fr: 'Bonjour ! Voici ma voix. J’enregistre un court échantillon pour que mon assistant puisse parler comme moi. C’est une bonne journée pour essayer quelque chose de nouveau.',
  it: 'Ciao! Questa è la mia voce. Sto registrando un breve campione affinché il mio assistente possa parlare come me. Oggi è un buon giorno per provare qualcosa di nuovo.',
  he: 'שלום! זה הקול שלי. אני מקליט דוגמה קצרה כדי שהעוזר שלי יוכל לדבר בדיוק כמוני. היום הוא יום טוב לנסות משהו חדש.',
  da: 'Hej! Det her er min stemme. Jeg optager en kort prøve, så min assistent kan tale ligesom mig. I dag er en god dag til at prøve noget nyt.',
  sv: 'Hej! Det här är min röst. Jag spelar in ett kort prov så att min assistent kan prata precis som jag. I dag är en bra dag att prova något nytt.',
  el: 'Γεια σας! Αυτή είναι η φωνή μου. Ηχογραφώ ένα σύντομο δείγμα ώστε ο βοηθός μου να μπορεί να μιλάει όπως εγώ. Σήμερα είναι μια καλή μέρα για να δοκιμάσω κάτι καινούργιο.',
  nl: 'Hallo! Dit is mijn stem. Ik neem een kort fragment op zodat mijn assistent net als ik kan spreken. Vandaag is een goede dag om iets nieuws te proberen.',
};

export function voiceCloneReadingText(language: AppLanguage): string {
  return VOICE_CLONE_READING_TEXTS[language];
}

type VoiceRecorderModule = {
  start(path: string): Promise<string>;
  status(): Promise<{ recording: boolean; seconds: number; peak: number }>;
  stop(): Promise<{ path: string; seconds: number }>;
  cancel(): Promise<void>;
  pickAudioFile(): Promise<{ path: string; name: string } | null>;
};

// The app's own native module (android/.../VoiceRecorderModule.kt,
// ios/ExampleApp/VoiceRecorder.m): microphone recording and the file picker.
function recorder(): VoiceRecorderModule {
  const module = NativeModules.VoiceRecorder as VoiceRecorderModule | undefined;
  if (!module) throw new Error('The voice recorder is not available in this build.');
  return module;
}

/**
 * Makes the cloned voices in clonedVoicesPath() selectable. Call after every
 * Speech.initAll() (a reload forgets the folder). Resolves their names.
 */
export async function loadClonedVoices(): Promise<string[]> {
  try {
    if (!(await RNFS.exists(clonedVoicesPath()))) await RNFS.mkdir(clonedVoicesPath());
    const names = await Speech.setExternalVoicesPath(clonedVoicesPath());
    console.log('[VoiceClone] cloned voices:', names);
    return names;
  } catch (error) {
    console.warn('[VoiceClone] loading cloned voices failed:', error);
    return [];
  }
}

/**
 * Why `name` can't be a new voice's name, or null when it can. The name is the
 * file name: letters, digits, spaces and dashes; no "_" (that marks a style of
 * a voice, e.g. Kate_whisper); not a bundled voice (the bundled one would win).
 */
export function voiceNameProblem(name: string, bundledVoices: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name for the new voice.';
  if (trimmed.length > 30) return 'Use at most 30 characters.';
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(trimmed)) {
    return 'Use letters, digits, spaces and dashes only, starting with a letter or digit.';
  }
  if (bundledVoices.some((voice) => voice.toLowerCase() === trimmed.toLowerCase())) {
    return `"${trimmed}" is a built-in voice. Pick another name.`;
  }
  return null;
}

export async function startVoiceRecording(): Promise<void> {
  await RNFS.unlink(RECORDING_PATH).catch(() => undefined);
  await recorder().start(RECORDING_PATH);
}

export function getVoiceRecordingStatus() {
  return recorder().status();
}

/** Stops the microphone recording; resolves the WAV file and its length. */
export function stopVoiceRecording() {
  return recorder().stop();
}

export async function cancelVoiceRecording(): Promise<void> {
  try {
    await recorder().cancel();
  } catch {
    // nothing was recording
  }
}

/**
 * Lets the user pick an audio file (wav, mp3, m4a, ...). Resolves a local copy
 * the TTS library can read, or null when the user cancels.
 */
export async function pickVoiceAudioFile(): Promise<{ path: string; name: string } | null> {
  return (await recorder().pickAudioFile()) ?? null;
}

/**
 * Creates the voice `name` from `audioPath`, saved in clonedVoicesPath().
 * `volume`: 1 keeps the recording's loudness, 1.2 is 20% louder, 0.8 20% quieter.
 */
export async function createClonedVoice(audioPath: string, name: string, volume = 1): Promise<VoiceCloneResult> {
  if (!(await RNFS.exists(clonedVoicesPath()))) await RNFS.mkdir(clonedVoicesPath());
  // Same name (voice names ignore case): the new voice replaces the old one.
  const fileName = `${name.trim()}.emd`.toLowerCase();
  for (const item of await RNFS.readDir(clonedVoicesPath())) {
    if (item.isFile() && item.name.toLowerCase() === fileName) await RNFS.unlink(item.path);
  }
  // Make sure the folder is the library's external voices folder, so the new
  // voice is selectable right away.
  await Speech.setExternalVoicesPath(clonedVoicesPath());
  const result = await Speech.createVoiceClone(
    audioPath,
    `${clonedVoicesPath()}/${name.trim()}.emd`,
    getVoiceEmbedder(),
    volume,
  );
  console.log(`[VoiceClone] created "${result.voice}" (volume ${volume})`);
  return result;
}

/**
 * Deletes the cloned voice `name` (its .emd and its styles, <name>_<style>.emd)
 * from clonedVoicesPath(). Resolves the cloned voices that remain.
 */
export async function deleteClonedVoice(name: string): Promise<string[]> {
  const voice = name.trim().toLowerCase();
  if (await RNFS.exists(clonedVoicesPath())) {
    for (const item of await RNFS.readDir(clonedVoicesPath())) {
      const file = item.name.toLowerCase();
      if (item.isFile() && (file === `${voice}.emd` || (file.startsWith(`${voice}_`) && file.endsWith('.emd')))) {
        await RNFS.unlink(item.path);
      }
    }
  }
  console.log(`[VoiceClone] deleted "${name}"`);
  return loadClonedVoices();
}
