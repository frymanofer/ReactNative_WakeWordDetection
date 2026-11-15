/**
 * Speaker verification (SV) with react-native-wakeword.
 *
 *   enrollmentScript() - what the user reads aloud during enrollment: the wake word several times plus other sentences
 *   enrollVoice()      - records SV_ENROLLMENT_SAMPLES short samples of the user's voice and returns the voice profile (JSON)
 *   saveVoiceProfile() / loadVoiceProfilePath() / deleteVoiceProfile() - keep the profile in the app's documents folder
 *   startVoiceTest()   - listens continuously and reports a score against the saved profile while the user talks
 *
 * The saved profile is what startListening() (wakeword.ts) takes to make the wake word answer only to that voice.
 * Stop wake word detection before enrolling or testing: one microphone user at a time.
 */
import RNFS from 'react-native-fs';
import {
  createSpeakerVerificationMicController,
  onSpeakerVerificationError,
  onSpeakerVerificationOnboardingDone,
  onSpeakerVerificationOnboardingProgress,
  onSpeakerVerificationVerifyResult,
} from 'react-native-wakeword';
import { SV_DECISION_THRESHOLD, SV_ENROLLMENT_SAMPLES, SV_MODEL, SV_PROFILE_FILE } from './config';

/** While talking, a match is kept for this long so short pauses between words don't flip the result to "no". */
const MATCH_HOLD_MS = 750;
/** How often the voice test reports a score while the user talks. */
const TEST_HOP_SECONDS = 0.25;

/**
 * The lines the user reads aloud during enrollment, one per sample: the wake word several times (alone and in a
 * request) and a few other sentences, so the profile learns the voice, not only one phrase.
 */
export function enrollmentScript(wakePhrase: string): string[] {
  const lines = [
    `${wakePhrase}`,
    `${wakePhrase}, what's the weather like today?`,
    'I am setting up my voice so the app knows it is me.',
    `${wakePhrase}`,
    `${wakePhrase}, set a timer for five minutes.`,
    'One, two, three, four, five, six, seven, eight, nine, ten.',
  ];
  return Array.from({ length: SV_ENROLLMENT_SAMPLES }, (_, i) => lines[i % lines.length]);
}

const micConfig = JSON.stringify({
  modelPath: SV_MODEL,
  options: {
    decisionThreshold: SV_DECISION_THRESHOLD,
    tailSeconds: 2.0,
    frameSize: 1280,
    maxTailSeconds: 3.0,
    cmn: true,
    expectedLayoutBDT: false,
  },
});

const profilePath = () => `${RNFS.DocumentDirectoryPath}/${SV_PROFILE_FILE}`;

export async function saveVoiceProfile(profileJson: string): Promise<string> {
  await RNFS.writeFile(profilePath(), profileJson, 'utf8');
  return profilePath();
}

/** The saved profile's path, or null when no voice is enrolled. */
export async function loadVoiceProfilePath(): Promise<string | null> {
  const path = profilePath();
  if (!(await RNFS.exists(path))) return null;
  const json = await RNFS.readFile(path, 'utf8');
  return json && json.length > 10 ? path : null;
}

export async function deleteVoiceProfile(): Promise<void> {
  const path = profilePath();
  if (await RNFS.exists(path)) await RNFS.unlink(path);
}

/** Waits for one event of `subscribe` for `controllerId` (or an SV error), up to `timeoutMs`. */
function nextEvent<T>(
  controllerId: string,
  subscribe: (cb: (e: any) => void) => () => void,
  timeoutMs: number,
  accept: (e: any) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      off();
      offError();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('No voice heard in time. Please try again.'));
    }, timeoutMs);
    const off = subscribe((e) => {
      if (e?.controllerId && e.controllerId !== controllerId) return;
      if (!accept(e)) return;
      cleanup();
      resolve(e as T);
    });
    const offError = onSpeakerVerificationError((e: any) => {
      if (e?.controllerId && e.controllerId !== controllerId) return;
      cleanup();
      reject(new Error(`Speaker verification error: ${e?.error ?? JSON.stringify(e)}`));
    });
  });
}

/**
 * Enrolls the user's voice: collects SV_ENROLLMENT_SAMPLES samples from the microphone (the user talks naturally,
 * a few seconds each) and returns the voice profile JSON. `onProgress(collected, target)` after each sample.
 */
export async function enrollVoice(onProgress?: (collected: number, target: number) => void): Promise<string> {
  const controllerId = `svEnroll_${Date.now()}`;
  const ctrl = await createSpeakerVerificationMicController(controllerId);
  try {
    await ctrl.create(micConfig);
    const done = nextEvent<any>(controllerId, onSpeakerVerificationOnboardingDone, 120000);
    await ctrl.beginOnboarding('davoice', SV_ENROLLMENT_SAMPLES, true);
    let collected = 0;
    let doneEvent: any = null;
    done.then((e) => (doneEvent = e)).catch(() => {});
    while (collected < SV_ENROLLMENT_SAMPLES && !doneEvent) {
      const before = collected;
      const progress = nextEvent<any>(controllerId, onSpeakerVerificationOnboardingProgress, 30000, (e) => Number(e?.collected ?? 0) > before);
      progress.catch(() => {}); // when "done" wins the race below, this wait times out on its own
      await ctrl.getNextEmbeddingFromMic();
      const e = await Promise.race([progress, done]);
      collected = Number(e?.collected ?? collected + 1);
      onProgress?.(Math.min(collected, SV_ENROLLMENT_SAMPLES), SV_ENROLLMENT_SAMPLES);
    }
    const finished = doneEvent ?? (await done);
    const profileJson: string | null = finished?.enrollmentJson ?? finished?.enrollment ?? finished?.json ?? null;
    if (!profileJson || profileJson.length < 10) throw new Error('Enrollment finished without a voice profile.');
    return profileJson;
  } finally {
    await ctrl.destroy().catch(() => {});
  }
}

export type VoiceTestScore = { score: number; isMatch: boolean };

/**
 * Voice test: listens continuously and calls `onScore` every TEST_HOP_SECONDS while the user talks (a short single
 * check scores half a second of audio, often before the user has started speaking). Returns `stop()`.
 */
export async function startVoiceTest(
  profileJson: string,
  onScore: (result: VoiceTestScore) => void,
  onError?: (message: string) => void,
): Promise<() => Promise<void>> {
  const controllerId = `svTest_${Date.now()}`;
  const ctrl = await createSpeakerVerificationMicController(controllerId);
  await ctrl.create(micConfig);
  await ctrl.setEnrollmentJson(profileJson);

  let holdUntil = 0;
  let holdBest = Number.NaN;
  const offResult = onSpeakerVerificationVerifyResult((e: any) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;
    const score = Number(e?.scoreBest ?? e?.bestScore ?? e?.score ?? NaN);
    const now = Date.now();
    const match = !!e?.isMatch || (Number.isFinite(score) && score >= SV_DECISION_THRESHOLD);
    if (match) {
      holdBest = now < holdUntil && Number.isFinite(holdBest) ? Math.max(holdBest, score) : score;
      holdUntil = now + MATCH_HOLD_MS;
    }
    const held = now < holdUntil;
    onScore({ score: held && Number.isFinite(holdBest) ? holdBest : score, isMatch: held });
  });
  const offError = onSpeakerVerificationError((e: any) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;
    onError?.(`Speaker verification error: ${e?.error ?? JSON.stringify(e)}`);
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    offResult();
    offError();
    await ctrl.stop().catch(() => {});
    await ctrl.destroy().catch(() => {});
  };
  try {
    // endless mode: the microphone stays open until stop(); stopOnMatch=false, resetState=true
    await ctrl.startEndlessVerifyFromMic(TEST_HOP_SECONDS, false, true);
  } catch (e) {
    await stop();
    throw e;
  }
  return stop;
}

export async function readVoiceProfile(path: string): Promise<string> {
  return RNFS.readFile(path, 'utf8');
}
