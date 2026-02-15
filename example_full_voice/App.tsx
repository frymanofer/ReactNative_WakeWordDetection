/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import RNFS from 'react-native-fs';

import React, { useEffect, useState, useRef } from 'react';

import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
//import { check, request, openSettings, PERMISSIONS, RESULTS } from 'react-native-permissions';

import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  AppState,
} from 'react-native';

const ARIANA = 1;
const RICH = 0;
const SPEAKER = ARIANA;
const SPEAKER_SPEED = 0.90;
const SV_MATCH_HOLD_MS = 1000;
const SV_ONBOARDING_SAMPLE_COUNT = 5;

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
  }
}

// Below is a part of Speech Feature to play mp3 and WAV file within the same Audio framework.
// You call Speech.playWav with any mp3/wav etc' file you need 
const moonRocksSound = require('./assets/cashRegisterSound.mp3');
const subtractMoonRocksSound = require('./assets/bellServiceDeskPressXThree.mp3');

// This is how you send the speech library the tts model.
const ttsModel = require('./assets/models/model_ex.dm');
//const ttsModel = 'model.onnx';

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
// If you created audioRoutingConfig.ts in the lib:
import { setWakewordAudioRoutingConfig } from 'react-native-wakeword';
import type { AudioRoutingConfig } from 'react-native-wakeword';
import {
  createSpeakerVerificationInstance,
  createSpeakerVerificationMicController,
  onSpeakerVerificationOnboardingProgress,
  onSpeakerVerificationOnboardingDone,
  onSpeakerVerificationVerifyResult,
  onSpeakerVerificationError,
} from 'react-native-wakeword';

async function writeEnrollmentJsonToFile(enrollmentJson: string, filename = 'sv_enrollment.json') {
  const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, enrollmentJson, 'utf8');
  console.log('[SVJS] wrote enrollment json to', path, 'len=', enrollmentJson.length);
  return path;
}

// ✅ NEW: endless/continuous mic verification (FIXED: uses native endless mode)
async function startEndlessVerificationWithEnrollmentFix(
  enrollmentJson,
  setUiMessage,
  opts
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] startEndlessVerificationWithEnrollmentFix: enrollmentJson is missing');
  }

  const hopSeconds = Number(opts?.hopSeconds ?? 0.25);
  const stopOnMatch = !!opts?.stopOnMatch;
  const waitFirstResult = !!opts?.waitFirstResult;
  const firstResultTimeoutMs = Number(opts?.firstResultTimeoutMs ?? 3000);
  const onStopReady = opts?.onStopReady;
  const onScore = opts?.onScore;
  const matchHoldMs = Number(opts?.matchHoldMs ?? SV_MATCH_HOLD_MS);

  const micConfig = {
    modelPath: 'speaker_model.dm',
    options: {
      decisionThreshold: 0.35,
      //tailSeconds: 2.0,
      tailSeconds: 1.0,
      frameSize: 1280,
      maxTailSeconds: 1.5,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  const controllerId = `svVerifyMicFix_${Date.now()}`;
  const ctrl = await createSpeakerVerificationMicController(controllerId);
  await ctrl.create(JSON.stringify(micConfig));
  await ctrl.setEnrollmentJson(enrollmentJson);

  // First-result gate
  let firstDone = false;
  let firstResolve: any = null;
  let firstReject: any = null;
  const firstResultPromise = new Promise((resolve, reject) => {
    firstResolve = resolve;
    firstReject = reject;
  });
  const firstTimeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ timeout: true }), firstResultTimeoutMs)
  );

  let stoppedResolve: any = null;
  const stoppedPromise = new Promise<void>((resolve) => {
    stoppedResolve = resolve;
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { offR?.(); } catch {}
    try { offE?.(); } catch {}
    try { await ctrl.stop?.(); } catch {}
    try { await ctrl.destroy?.(); } catch {}
    if (!firstDone) {
      firstDone = true;
      try { firstResolve({ stopped: true }); } catch {}
    }
    try { stoppedResolve?.(); } catch {}
  };

  const offE = onSpeakerVerificationError((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;
    console.log('[SVJS-FIX] SV ERROR event:', e);
    setUiMessage?.(`⚠️ SV error: ${e?.error ?? JSON.stringify(e)}`);

    if (!firstDone) {
      firstDone = true;
      try { firstReject(new Error(e?.error ?? 'SV_ERROR')); } catch {}
    }
    stop(); // stop on error
  });

  const offR = onSpeakerVerificationVerifyResult((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;

    const best = Number(e?.scoreBest ?? e?.bestScore ?? e?.score ?? NaN);
    const ok = !!e?.isMatch;
    const nowMs = Date.now();
    const hasBest = Number.isFinite(best);
    if (ok) {
      matchHoldUntilMs = nowMs + matchHoldMs;
      holdBestScore = hasBest ? best : holdBestScore;
    }
    const inHoldWindow = nowMs < matchHoldUntilMs;
    if (!ok && inHoldWindow && hasBest) {
      holdBestScore = Number.isFinite(holdBestScore) ? Math.max(holdBestScore, best) : best;
    }

    const showAsMatch = ok || inHoldWindow;
    const scoreToShow = showAsMatch && Number.isFinite(holdBestScore) ? holdBestScore : best;
    console.log('[SVJS-FIX] SV VERIFY:', e);
    setUiMessage?.(`🔐 SV(best=${Number.isFinite(scoreToShow) ? scoreToShow.toFixed(3) : 'n/a'}) match=${showAsMatch ? '✅' : '❌'}`);
    onScore?.(scoreToShow, showAsMatch);

    if (!firstDone) {
      firstDone = true;
      try { firstResolve(e); } catch {}
    }

    // Native endless mode keeps emitting; only stop here if requested.
    if (stopOnMatch && ok) stop();
  });
  let matchHoldUntilMs = -1_000_000_000;
  let holdBestScore = Number.NaN;

  setUiMessage?.(`🎙️ SV continuous verify FIX started (hop=${hopSeconds}s)`);

  // ✅ KEY FIX: use native endless mode (mic stays open, emits every hopSeconds)
  await ctrl.startEndlessVerifyFromMic(hopSeconds, stopOnMatch, true);

  // Pass stop function out so caller can stop from UI
  onStopReady?.(stop);

  if (waitFirstResult) {
    try {
      await Promise.race([firstResultPromise, firstTimeoutPromise]);
    } catch {
      // ignore here; error handler already stopped
    }
    await stoppedPromise; // blocks until stop()
  }

  return stop;
}

// ✅ NEW: endless/continuous mic verification (returns stop() to cleanup)
async function startEndlessVerificationWithEnrollment(
  enrollmentJson,
  setUiMessage,
  opts
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] startEndlessVerificationWithEnrollment: enrollmentJson is missing');
  }

  const hopSeconds = Number(opts?.hopSeconds ?? 0.25);
  const stopOnMatch = !!opts?.stopOnMatch;
  const waitFirstResult = !!opts?.waitFirstResult;
  const firstResultTimeoutMs = Number(opts?.firstResultTimeoutMs ?? 3000);
  const onStopReady = opts?.onStopReady;
  const onScore = opts?.onScore;

  const micConfig = {
    modelPath: 'speaker_model.dm',
    options: {
      decisionThreshold: 0.35,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  const controllerId = `svVerifyMic_${Date.now()}`;
  const ctrl = await createSpeakerVerificationMicController(controllerId);
  await ctrl.create(JSON.stringify(micConfig));
  await ctrl.setEnrollmentJson(enrollmentJson);

  // First-result gate
  let firstDone = false;
  let firstResolve: any = null;
  let firstReject: any = null;
  const firstResultPromise = new Promise((resolve, reject) => {
    firstResolve = resolve;
    firstReject = reject;
  });
  const firstTimeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ timeout: true }), firstResultTimeoutMs)
  );

  let stoppedResolve: any = null;
  const stoppedPromise = new Promise<void>((resolve) => {
    stoppedResolve = resolve;
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { offR?.(); } catch {}
    try { offE?.(); } catch {}
    try { await ctrl.stop?.(); } catch {}
    try { await ctrl.destroy?.(); } catch {}
    if (!firstDone) {
      firstDone = true;
      try { firstResolve({ stopped: true }); } catch {}
    }
    try { stoppedResolve?.(); } catch {}
  };

  const offE = onSpeakerVerificationError((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;
    console.log('[SVJS] SV ERROR event:', e);
    setUiMessage?.(`⚠️ SV error: ${e?.error ?? JSON.stringify(e)}`);

    if (!firstDone) {
      firstDone = true;
      try { firstReject(new Error(e?.error ?? 'SV_ERROR')); } catch {}
    }

    stop(); // stop on error
  });

  const offR = onSpeakerVerificationVerifyResult((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;

    const best = Number(e?.scoreBest ?? e?.bestScore ?? e?.score ?? NaN);
    const ok = !!e?.isMatch;
    console.log('[SVJS] SV VERIFY:', e);
    setUiMessage?.(`🔐 SV best=${Number.isFinite(best) ? best.toFixed(3) : 'n/a'} match=${ok ? '✅' : '❌'}`);
    onScore?.(best, ok);

    if (!firstDone) {
      firstDone = true;
      try { firstResolve(e); } catch {}
    }

    // allow next cycle
    inFlight = false;

    if (stopOnMatch && ok) {
      stop();
      return;
    }

    // hop delay then start next verify (resetState=true for fresh audio each cycle)
    setTimeout(() => {
      kick(true).catch((err) => {
        console.log('[SVJS] kick failed:', err);
        stop();
      });
    }, Math.max(0.05, hopSeconds) * 1000);
  });

  let inFlight = false;
  const kick = async (resetState: boolean) => {
    if (stopped) return;
    if (inFlight) return;
    inFlight = true;
    try {
      await ctrl.startVerifyFromMic(resetState);
    } catch (e) {
      inFlight = false;
      if (!firstDone) {
        firstDone = true;
        try { firstReject(e); } catch {}
      }
      throw e;
    }
  };

  setUiMessage?.(`🎙️ SV continuous verify started (hop=${hopSeconds}s)`);
  await kick(true); // first call resets state; subsequent calls keep buffer

  // Pass stop function out before blocking, so caller can stop from UI
  onStopReady?.(stop);

  // Optionally wait before returning
  if (waitFirstResult) {
    try {
      await Promise.race([firstResultPromise, firstTimeoutPromise]);
    } catch {
      // ignore here; error handler already stopped
    }
    await stoppedPromise;     // blocks forever until stop() runs
  }

  return stop;
}

// ✅ NEW: mic-verify helper (THIS is what your code was calling)
async function verifyFromMicWithEnrollment(
  enrollmentJson: string,
  setUiMessage?: (s: string) => void
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] verifyFromMicWithEnrollment: enrollmentJson is missing');
  }

  const micConfig = {
    modelPath: 'speaker_model.dm',
    options: {
      decisionThreshold: 0.35,
      // tailSeconds: 2.0,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  const controllerId = 'svVerifyMic1';
  const ctrl = await createSpeakerVerificationMicController(controllerId);
  await ctrl.create(JSON.stringify(micConfig));
  await ctrl.setEnrollmentJson(enrollmentJson);

  const TIMEOUT_MS = 60_000;

  try {
    const res = await new Promise<any>((resolve, reject) => {
      const t = setTimeout(() => {
        offR?.(); offE?.();
        reject(new Error('NO_SPEECH_TIMEOUT'));
      }, TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(t);
        offR?.(); offE?.();
      };

      const offE = onSpeakerVerificationError((e) => {
        if (e?.controllerId && e.controllerId !== controllerId) return;
        cleanup();
        reject(new Error(`[SVJS] SV ERROR event: ${JSON.stringify(e)}`));
      });

      const offR = onSpeakerVerificationVerifyResult((e) => {
        if (e?.controllerId && e.controllerId !== controllerId) return;
        cleanup();
        resolve(e);
      });

      ctrl.startVerifyFromMic(true).catch((err) => {
        cleanup();
        reject(err);
      });
    });

    return res;
  } finally {
    try { await ctrl.stop?.(); } catch {}
    try { await ctrl.destroy?.(); } catch {}
  }
}

async function runVerificationWithEnrollment(
  enrollmentJson: string,
  setUiMessage?: (s: string) => void
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] runVerificationWithEnrollment: enrollmentJson is missing');
  }

  const micConfig = {
    modelPath: 'speaker_model.dm',
    options: {
      decisionThreshold: 0.35,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  // 1) Persist enrollmentJson so native can load it like a normal file
  const enrollmentPath = await writeEnrollmentJsonToFile(enrollmentJson, 'yaroslav_enrollment_runtime.json');

  // 2) Create a SpeakerVerification engine instance (NOT the mic controller)
  const sv = await createSpeakerVerificationInstance('svVerify1');
  await sv.create(
    micConfig.modelPath,
    enrollmentPath,               // <-- IMPORTANT: use the file path we just wrote
    micConfig.options
  );

  // ---------- (A) Verify WAV files ----------
  const wavs = [
    'ekaterina_sample_1760703001874.wav',
    'james_sample_1760701252720.wav',
    'y1.wav',
    'y2.wav',
    'y3.wav',
  ];

  setUiMessage?.('🔐 Verifying WAV files...');
  for (const wav of wavs) {
    try {
      const out = await sv.verifyWavStreaming(wav, true); // resetState=true
      console.log('[SVJS] verifyWav:', wav, out);
      setUiMessage?.(`🔐 WAV: ${wav} → score=${out?.bestScore ?? out?.score ?? 'n/a'}`);
    } catch (e) {
      console.log('[SVJS] verifyWav FAILED:', wav, e);
      setUiMessage?.(`⚠️ WAV verify failed: ${wav}`);
    }
  }

  // ---------- (B) 3 mic trials, wait up to 60s each ----------
  const lines: string[] = [];
  let lastScore: any = null;
  const extractScore = (res: any) => {
    // your log shows: scoreBest / scoreMean / scoreWorst
    return res?.scoreBest ?? res?.bestScore ?? res?.score ?? null;
  };
  const fmt = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(3) : 'n/a';
  };
  const render = (trial: number) => {
    const header = `🎙️ Mic verify trial ${trial}/3 — speak now (up to 60s)...`;
    const last = `last score: ${fmt(lastScore)}`;
    return [header, ...lines, last].join('\n');
  };

  for (let t = 1; t <= 3; t++) {
    // Always show what we have so far (previous score if exists)
    // Always show previous scores + last score BEFORE starting the mic trial
    setUiMessage?.(render(t));
    try {
      const res = await verifyFromMicWithEnrollment(enrollmentJson, setUiMessage);
      console.log('[SVJS] mic verify result:', res);
      const score = extractScore(res);
      lastScore = score;
      lines.push(`verification #${t} score: ${fmt(score)}`);
      // Keep showing history (and last score)
      setUiMessage?.(render(Math.min(t + 1, 3)));
    } catch (e: any) {
      if (String(e?.message || e).includes('NO_SPEECH_TIMEOUT')) {
        lines.push(`verification #${t} score: n/a`);
        setUiMessage?.(render(Math.min(t + 1, 3)));
        continue;
      }
      lines.push(`verification #${t} score: n/a`);
      setUiMessage?.(render(Math.min(t + 1, 3)));
      console.log('[SVJS] mic verify ERROR:', e);
    }
  }
  // Final summary (exact format you asked)
  setUiMessage?.(lines.join('\n'));
  await sv.destroy();
}

async function runSpeakerVerifyEnrollment(
  setUiMessage?: (s: string) => void,
  sampleCount: number = SV_ONBOARDING_SAMPLE_COUNT
): Promise<string> {
  const targetSamples = Math.max(1, Math.floor(sampleCount));
  const micConfig = {
    modelPath: 'speaker_model.dm',
    options: {
      decisionThreshold: 0.35,
      // TODO IOS IGNORES tailSeconds!!! AND ANDROID DOES NOT!!!
      tailSeconds: 1.0,
      frameSize: 1280,
      maxTailSeconds: 1.5,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  const ctrl = await createSpeakerVerificationMicController('svMic1');
  setUiMessage?.('🎙️ Speaker onboarding: preparing mic…');

  console.log('[SVJS] create mic controller...');
  await ctrl.create(JSON.stringify(micConfig));

  let collected = 0;
  let target = targetSamples;
  let enrollmentJson: string | null = null;

  const waitForNextSVStep = (controllerId: string, beforeCollected: number, timeoutMs = 25000) => {
    return new Promise<{ type: 'progress' | 'done'; ev: any }>((resolve, reject) => {
      const t = setTimeout(() => {
        offP?.();
        offD?.();
        offE?.();
        reject(new Error(`[SVJS] timeout waiting for progress/done (before=${beforeCollected})`));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(t);
        offP?.();
        offD?.();
        offE?.();
      };

      const offE = onSpeakerVerificationError((e) => {
        if (e?.controllerId !== controllerId) return;
        cleanup();
        reject(new Error(`[SVJS] SV ERROR event: ${JSON.stringify(e)}`));
      });

      const offP = onSpeakerVerificationOnboardingProgress((e) => {
        if (e?.controllerId !== controllerId) return;
        const c = Number(e?.collected ?? 0);
        if (c > beforeCollected) {
          cleanup();
          resolve({ type: 'progress', ev: e });
        }
      });

      const offD = onSpeakerVerificationOnboardingDone((e) => {
        if (e?.controllerId !== controllerId) return;
        cleanup();
        resolve({ type: 'done', ev: e });
      });
    });
  };

  const offErr = onSpeakerVerificationError((e) => {
    console.log('[SVJS] ERROR event:', e);
  });

  const offProg = onSpeakerVerificationOnboardingProgress((e) => {
    if (e?.controllerId !== 'svMic1') return;
    console.log('[SVJS] PROGRESS event:', e);
    collected = Number(e?.collected ?? collected);
    target = Number(e?.target ?? target);
  });

  const donePromise = new Promise<void>((resolve, reject) => {
    let finished = false;
    const offDone = onSpeakerVerificationOnboardingDone((e) => {
      if (e?.controllerId !== 'svMic1') return;
      if (finished) return;
      finished = true;
      console.log('[SVJS] DONE event:', e);
      enrollmentJson = e?.enrollmentJson ?? e?.enrollment ?? e?.json ?? null;
      offDone?.();
      resolve();
    });
    setTimeout(() => {
      if (finished) return;
      finished = true;
      offDone?.();
      reject(new Error('[SVJS] timeout waiting for onboarding done'));
    }, 60000);
  });

  setUiMessage?.('🎙️ Speaker onboarding: start. Please speak clearly when asked…');
  await ctrl.beginOnboarding?.('yaroslav', targetSamples, true);

  for (let i = 1; i <= targetSamples; i++) {
    console.log('[SVJS] requesting embedding', i, '/', targetSamples);
    setUiMessage?.(`🎙️ Please speak now… collecting sample ${i}/${targetSamples} (about 2s)`);

    const before = collected;
    const stepPromise = waitForNextSVStep('svMic1', before, 30000);
    await ctrl.getNextEmbeddingFromMic();
    const step = await stepPromise;

    if (step.type === 'done') {
      const e = step.ev;
      enrollmentJson = e?.enrollmentJson ?? e?.enrollment ?? e?.json ?? enrollmentJson;
      setUiMessage?.('✅ Speaker onboarding completed.');
      break;
    }

    setUiMessage?.(`✅ Collected ${Math.min(collected, targetSamples)}/${targetSamples} samples`);
  }

  setUiMessage?.('✅ Finalizing speaker profile…');
  await donePromise;

  if (!enrollmentJson || typeof enrollmentJson !== 'string' || enrollmentJson.length < 10) {
    offProg?.();
    offErr?.();
    try { await ctrl.destroy?.(); } catch {}
    throw new Error('[SVJS] onboarding done but enrollmentJson is empty/invalid');
  }

  console.log('[SVJS] enrollmentJson len=', enrollmentJson.length);
  await ctrl.setEnrollmentJson(enrollmentJson);
  setUiMessage?.('✅ Speaker profile saved. Continuing…');

  offProg?.();
  offErr?.();

  // recommended: close mic-controller to avoid fighting resources during verification
  try { await ctrl.destroy?.(); } catch {}

  return enrollmentJson;
}

/* New Speaker verification  
async function runSpeakerVerifyEnrollment() {
  // 1) Create instance
  const sv = await createSpeakerVerificationInstance('sv1');

  // 2) Create native engine (bundle resource names)
  const createRes = await sv.create(
    'speaker_model.dm',
    'yaroslav_enrollment.json',
    {
      decisionThreshold: 0.35,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
      cmn: true,
      expectedLayoutBDT: false,
      // logLevel: 5, // trace
    }
  );
  console.log('SV createRes:', createRes);

  // 3) Verify multiple wavs (bundle resource names)
  const wavs = [
    'ekaterina_sample_1760703001874.wav',
    'james_sample_1760701252720.wav',
    'y1.wav',
    'y2.wav',
    'y3.wav',
  ];

  for (const wav of wavs) {
    const out = await sv.verifyWavStreaming(wav, true); // true == resetState
    console.log('SV verify:', wav, out);
  }

  // 4) Cleanup
  await sv.destroy();
}
*/
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
    mode: 'default',
    options: [
      'mixWithOthers',
      'allowBluetooth',
      'allowBluetoothA2DP',
      'allowAirPlay',
      'defaultToSpeaker',
    ],
    preferredInput: 'none',
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
        'allowBluetooth',
        'allowBluetoothA2DP',
        'allowAirPlay',
        'defaultToSpeaker',
      ],
      preferredInput: 'none',
    },

    // ✅ NEW: when we’re already on built-in speaker, keep SAME config
    builtInSpeaker: {
      category: 'playAndRecord',
      mode: 'default',
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
      mode: 'default',
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
      mode: 'default',
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
      mode: 'default',
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
  const svStopRef = useRef<null | (() => Promise<void>)>(null);
  const [showSVPrompt, setShowSVPrompt] = useState(false);
  const [svRunning, setSvRunning] = useState(false);
  const svChoiceResolverRef = useRef<null | ((choice: boolean) => void)>(null);
  const [lastSVScore, setLastSVScore] = useState<{ score: number; isMatch: boolean } | null>(null);
  const lastSVScoreTimeRef = useRef<number | null>(null);
  const [svElapsed, setSvElapsed] = useState<string>('N/A');
  const svElapsedIntervalRef = useRef<any>(null);

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

  // // --- Speaker-ID flows (kept) ---
  // const initSpeakerIdWWD = async () => {
  //   try {
  //     const sidIdWWD = 'sidWWD';
  //     const sid = await createSpeakerIdInstance(sidIdWWD);
  //     await sid.createInstanceWWD();
  //     sidRef.current = sid;

  //     const hasDefault = await sid.initVerificationUsingCurrentConfig();
  //     if (!hasDefault) {
  //       setMessage('🎙️ Speaker setup: Please speak for ~3–5 seconds…');
  //       const ob = await sid.onboardFromMicrophoneWWD(3, 12000);
  //       setMessage(`✅ Enrolled (${ob.clusterSize} slices). Verifying…`);
  //       if (Platform.OS === 'android') await sleep(200);
  //     } else {
  //       setMessage('🔐 Found existing speaker profile. Verifying…');
  //     }

  //     const res = await sid.verifyFromMicrophoneWWD(6000);
  //     const ok = (res?.bestScore ?? 0) >= sidScoreAccept;
  //     console.log(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
  //     setMessage(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
  //   } catch (err) {
  //     console.error('[SpeakerId] init failed:', err);
  //     setMessage('⚠️ Speaker verification failed (see logs).');
  //   }
  // };

  // const initSpeakerId = async () => {
  //   try {
  //     const sid = await createSpeakerIdInstance(sidId);
  //     await sid.createInstance();
  //     sidRef.current = sid;

  //     const hasDefault = await sid.initVerificationUsingDefaults();

  //     if (!hasDefault) {
  //       setMessage('🎙️ Speaker setup: Please speak for ~3–5 seconds…');
  //       const ob = await sid.onboardFromMicrophone(12000);
  //       setMessage(`✅ Enrolled (${ob.clusterSize} slices). Verifying…`);
  //       if (Platform.OS === 'android') await sleep(200);
  //     } else {
  //       setMessage('🔐 Found existing speaker profile. Verifying…');
  //     }

  //     const res = await sid.verifyFromMicrophone(8000);
  //     const ok = (res?.bestScore ?? 0) >= sidScoreAccept;
  //     console.log(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
  //     setMessage(`${ok ? '✅' : '❓'} Speaker score: ${res?.bestScore?.toFixed?.(3) ?? 'n/a'} (${res?.bestTargetLabel ?? 'n/a'})`);
  //   } catch (err) {
  //     console.error('[SpeakerId] init failed:', err);
  //     setMessage('⚠️ Speaker verification failed (see logs).');
  //   }
  // };

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
  const [message, setMessage] = useState(`Full end-to-end voice demo app.\nSay the wake word "${wakeWords}" to continue.`);
  const [isSpeechSessionActive, setIsSpeechSessionActive] = useState(false);
  const [currentSpeechSentence, setCurrentSpeechSentence] = useState('');
  const lastPartialTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  let vadCBintervalID: any = null;
  const silenceThresholdMsRef = useRef(2000);
  const lastTranscriptRef = useRef('');
  const lastProcessedRef = useRef('');

  const SILENCE_TIMEOUT = 2000;
  function resetTranscript() {
    lastTranscriptRef.current = '';
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
    setIsSpeechSessionActive(true);
  };

  Speech.onSpeechEnd = async () => {
    console.log('***Sentence ended***:', lastTranscriptRef.current);
    if (lastTranscriptRef.current == '') {
      return;
    }
    //Speech.speak(lastTranscriptRef.current, 0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    lastTranscriptRef.current = '';
    setCurrentSpeechSentence('');
    //await Speech.start('en-US');
  };

  Speech.onSpeechPartialResults = (e) => {
    const curr = e.value?.[0];
    if (Platform.OS === 'ios') {
      if (curr && curr !== lastTranscriptRef.current) {
        lastTranscriptRef.current = curr;
        lastPartialTimeRef.current = Date.now();
        setCurrentSpeechSentence(curr);
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
    const merged = mergeSmartKeepPunct(lastTranscriptRef.current, curr, 2);
    if (merged === lastTranscriptRef.current) return; // no new info

    lastTranscriptRef.current = merged;
    setCurrentSpeechSentence(merged);
    console.log('Partial:', merged);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      console.log('⏳ Silence timeout reached, speaking:', lastTranscriptRef.current);
      const newText = lastTranscriptRef.current.trim();
      if (newText.length > 0) {
        console.log('🗣️ Speaking:', newText);
        setCurrentSpeechSentence(newText);
        lastProcessedRef.current = lastTranscriptRef.current;
        lastTranscriptRef.current = '';
        await Speech.pauseSpeechRecognition();
        await Speech.speak(newText, SPEAKER, SPEAKER_SPEED);
        await Speech.unPauseSpeechRecognition(1);
      }
      //await Speech.start('en-US');
    }, silenceThresholdMsRef.current);
  };

  Speech.onSpeechResults = async (e) => {
    if (Platform.OS === 'android') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('Results: ', e.value?.[0]);
      const current = e.value?.[0];
      if (current) setCurrentSpeechSentence(current);
      await Speech.speak(current, SPEAKER, SPEAKER_SPEED);
      return;
    }

    console.log('Results: ', e.value?.[0]);
    const current = e.value?.[0];
    if (!current || current === lastTranscriptRef.current) return;
    setCurrentSpeechSentence(current);

    const newWords = current.replace(lastTranscriptRef.current, '').trim();
    console.log('Heard new words:', newWords);

    lastTranscriptRef.current = current;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      console.log('⏳ Silence timeout reached, speaking:', lastTranscriptRef.current);
      const newText = lastTranscriptRef.current.slice(lastProcessedRef.current.length).trim();
      if (newText.length > 0) {
        console.log('🗣️ Speaking:', newText);
        setCurrentSpeechSentence(newText);
        await Speech.pauseSpeechRecognition();
        await Speech.speak(newText, SPEAKER, SPEAKER_SPEED);
        await Speech.unPauseSpeechRecognition(1);
        lastProcessedRef.current = lastTranscriptRef.current;
      }
    }, silenceThresholdMsRef.current);

  };

  let callbackTimes = 0;
  useEffect(() => {
    
    
    const keywordCallbackDuringSpeech = async (keywordIndex: any) => {
      console.log("keywordCallbackDuringSpeech: #callbacks == ", callbackTimes);
      callbackTimes +=1;
    }

    // --> WAKE WORD CALLBACK ENTRY !!!!
    // *** === keyword callback === ***
    //
    // THIS IS THE PLACE TO PLAY WITH ASR/STT and TTS
    //
    const keywordCallback = async (keywordIndex: any) => {
      const instance = myInstanceRef.current;
      if (!instance) return;
      const stopWakeWord = true;
      callbackTimes = 1;
      // 1) Remove listener first (prevents late events)
      /** *** NEW *** do not detachListener when not stopping wake word **/ 
      if (stopWakeWord)
        await detachListener();

      // TODO:
      // let wavFilePath = '';
      // let recordedWavPaths: string[] = [];
      // // 2) Stop detection (native)
      // try {
      //   if (stopWakeWord)
      //     await instance.stopKeywordDetection(/* FR add if stop microphone or */);
      //   /** ********* TODO ******* - NEW create a lite pause instead of full stop: **/
      //   // await instance.pauseKeywordDetection(/* FR add if stop microphone or */);
        
      //   wavFilePath = await instance.getRecordingWav();
      //   if (Platform.OS === "android") {
      //     recordedWavPaths = await instance.getRecordingWavArray();
      //   }
      //   console.log("paths == ", recordedWavPaths);
      // } catch {}
      await sleep(1500);

      console.log('detected keyword: ', keywordIndex);
      setMessage(`WakeWord '${keywordIndex}' DETECTED`);
      setIsFlashing(true);

      /***** SPEAKER VERIFICATION CODE ONLY *****/
      try {
        // Show SV prompt and wait for user choice
        setShowSVPrompt(true);
        const testSV = await new Promise<boolean>((resolve) => {
          svChoiceResolverRef.current = resolve;
        });
        setShowSVPrompt(false);

        if (testSV) {
          /*** --> ENROLLMENT HERE ***/
          const enrollmentJson = await runSpeakerVerifyEnrollment(setMessage);
          // Reset score tracking and start elapsed timer
          setLastSVScore(null);
          lastSVScoreTimeRef.current = null;
          setSvElapsed('N/A');
          svElapsedIntervalRef.current = setInterval(() => {
            const t = lastSVScoreTimeRef.current;
            if (t === null) {
              setSvElapsed('N/A');
            } else {
              const sec = (Date.now() - t) / 1000;
              setSvElapsed(sec < 60 ? `${sec.toFixed(1)}s` : `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`);
            }
          }, 100);

          setSvRunning(true);
          // await runVerificationWithEnrollment(enrollmentJson, setMessage);
  //        svStopRef.current = await startEndlessVerificationWithEnrollment(enrollmentJson, setMessage, { hopSeconds: 0.5, stopOnMatch: false });
          svStopRef.current = await startEndlessVerificationWithEnrollmentFix(
            enrollmentJson,
            setMessage,
            { hopSeconds: 0.25, stopOnMatch: false, waitFirstResult: true, firstResultTimeoutMs: 3000,
              onStopReady: (stopFn: () => Promise<void>) => { svStopRef.current = stopFn; },
              onScore: (score: number, isMatch: boolean) => {
                setLastSVScore({ score, isMatch });
                lastSVScoreTimeRef.current = Date.now();
              } }
          );
          // Cleanup timer when verification ends
          if (svElapsedIntervalRef.current) {
            clearInterval(svElapsedIntervalRef.current);
            svElapsedIntervalRef.current = null;
          }
          setSvRunning(false);
        }
        /***** END OF SPEAKER VERIFICATION CODE ONLY END *****/
 
        console.log('Calling Speech.initAll');

        setIsSpeechSessionActive(true);
        setCurrentSpeechSentence('');
        await Speech.initAll({ locale:'en-US', model: ttsModel });
        
        //await Speech.initAll({ locale:'en-US', model: ttsModel });
        // Spanish:
        // Spain: es-ES
        // Mexico: es-MX
        // US Spanish: es-US
        // Argentina: es-AR
        // Colombia: es-CO

        const off = Speech.onFinishedSpeaking = async () => {
          //await Speech.unPauseSpeechRecognition(1);
          console.log('onFinishedSpeaking(): ✅ Finished speaking (last WAV done).');
        };
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }

      // const runWakeWordWithSpeech = true;
      // if (runWakeWordWithSpeech) {
      //         // re-attach listener then start detection
      //   await attachListenerOnce(instance, keywordCallbackDuringSpeech);
      //   await instance.startKeywordDetection(instanceConfigs[0].threshold, true);
      // }

      /**** You can play what activated the wake word ****/
      // const wavPathsToPlay =
      //   recordedWavPaths.length > 0
      //     ? recordedWavPaths.filter(Boolean)
      //     : [wavFilePath].filter(Boolean);

      // for (const path of wavPathsToPlay) {
      //   const exists = await RNFS.exists(path);
      //   if (!exists) {
      //     console.log('Skipping missing wav path:', path);
      //     continue;
      //   }
      //   console.log('Speech.playWav ', path);
      //   await Speech.playWav(path, false);
      //   await sleep(1500);
      // }
      /**** END: You can play what activated the wake word ****/

      // await Speech.playWav(moonRocksSound, false);
      // await Speech.pauseSpeechRecognition();
      // await Speech.playWav(moonRocksSound, false);
      // await Speech.speak("Hi! Welcome to Lunafit! My name is " + ((SPEAKER == RICH) ? "Rich" : "Ariana") + ". Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!", SPEAKER, SPEAKER_SPEED);
      // await Speech.unPauseSpeechRecognition(-1);

      // await Speech.speak("This is the first, \
      //   react native package with full voice support! \
      //   Luna fitness application is using this package. \
      //   Inside Luna Fitness application you will here things like: \
      //   Besides tracking, LunaFit also gives you personalized plans for all those pillars and helps you crush your health and fitness goals. It's about owning your journey!");

      // setTimeout(async () => {
      //   await Speech.pauseSpeechRecognition();
      //   setTimeout(async () => {
      //     try {
      //       await tts.initTTS({model: 'model2.onnx'});
      //       await tts.speak("five dot twenty three");
      //       await Speech.playWav(moonRocksSound, false);
      //     }
      //     catch (error) {
      //       console.log("Speech.speak RAISE ERROR", error);
      //     }
      //   }, 300);
      // }, 30000);
      // setTimeout(async () => {
      //   await Speech.unPauseSpeechRecognition(1);
      // }, 100000);
      //  Restart detection after timeout

      /*** RESTARTING THE WAKEWORD ***/
      setTimeout(async () => {
        console.log('Restarting wake word');
        setMessage(`Full end-to-end voice demo app.\nSay the wake word "${wakeWords}" to continue.`);
        setIsFlashing(false);
        setIsSpeechSessionActive(false);
        setCurrentSpeechSentence('');

        await Speech.destroyAll();

        if (Platform.OS === 'android') {
          await sleep(300);
        }

        // re-attach listener then start detection
        await attachListenerOnce(instance, keywordCallback);
        await instance.startKeywordDetection(instanceConfigs[0].threshold, true);
      }, 300000);
//      }, 300000);
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

        // --> CREATE THE INSTANCE !!!!
        try {
          console.log('Adding element:', instanceConfigs[0]);
          const instance = await addInstanceMulti(instanceConfigs[0]);
          myInstanceRef.current = instance;
        } catch (error) {
          console.error('Error loading model:', error);
          return;
        }

        // --> Attach the callback !!!!
        const inst = myInstanceRef.current!;
        await attachListenerOnce(inst, keywordCallback);

        const isLicensed = await inst.setKeywordDetectionLicense(
          'MTc3NDkwNDQwMDAwMA==-z/W+fYYTMV1BNZqFL2eKFcETpOideVer8igwlAA4OWI='
        );
        if (!isLicensed) {
          console.error('No License!!! - setKeywordDetectionLicense returned', isLicensed);
          setMessage('Lincese not valid: Please contact info@davoice.io for a new license');
          return;
        }

        /* Below code with enableDucking/disableDucking and startKeywordDetection(xxx, false, ...) - where
        false is the second argument is used to initialze other audio sessions before wake word to duck others etc'
        You can aslo make wake word use the same settings and not chaning audio session.
        // await disableDucking();
        // await enableDucking();
        // await inst.startKeywordDetection(instanceConfigs[0].threshold, false);
        */
        await inst.startKeywordDetection(instanceConfigs[0].threshold, true);
        //await disableDucking();

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
      colors={isDarkMode ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#667eea', '#764ba2']}
      style={styles.linearGradient}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.container}>
        {/* Main message card */}
        <View
          style={[
            styles.messageCard,
            isFlashing && styles.messageCardFlashing,
          ]}>
          <Text style={styles.appLabel}>VOICE DEMO</Text>
          <Text style={styles.title}>{message}</Text>
        </View>

        {isSpeechSessionActive && (
          <View style={styles.speechSentenceCard}>
            <Text style={styles.speechSentenceLabel}>Current Sentence</Text>
            <Text style={styles.speechSentenceText}>
              {currentSpeechSentence || 'Listening...'}
            </Text>
          </View>
        )}

        {/* Speaker Verification prompt */}
        {showSVPrompt && (
          <View style={styles.svPromptContainer}>
            <Text style={styles.svPromptText}>Test Speaker Verification?</Text>
            <View style={styles.svButtonRow}>
              <TouchableOpacity
                style={[styles.svButton, styles.svButtonYes]}
                activeOpacity={0.7}
                onPress={() => svChoiceResolverRef.current?.(true)}>
                <Text style={styles.svButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.svButton, styles.svButtonNo]}
                activeOpacity={0.7}
                onPress={() => svChoiceResolverRef.current?.(false)}>
                <Text style={styles.svButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SV score tracking + Stop button */}
        {svRunning && (
          <View style={styles.svScoreContainer}>
            <Text style={styles.svScoreLabel}>Speaker Verification</Text>
            <View style={styles.svScoreRow}>
              <View style={styles.svScoreItem}>
                <Text style={styles.svScoreItemLabel}>Last Score</Text>
                <Text style={styles.svScoreValue}>
                  {lastSVScore ? lastSVScore.score.toFixed(3) : 'N/A'}
                </Text>
              </View>
              <View style={styles.svScoreItem}>
                <Text style={styles.svScoreItemLabel}>Match</Text>
                <Text style={styles.svScoreValue}>
                  {lastSVScore ? (lastSVScore.isMatch ? 'YES' : 'NO') : 'N/A'}
                </Text>
              </View>
              <View style={styles.svScoreItem}>
                <Text style={styles.svScoreItemLabel}>Since Last</Text>
                <Text style={styles.svScoreValue}>{svElapsed}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.svStopButton}
              activeOpacity={0.7}
              onPress={async () => {
                if (svElapsedIntervalRef.current) {
                  clearInterval(svElapsedIntervalRef.current);
                  svElapsedIntervalRef.current = null;
                }
                if (svStopRef.current) {
                  await svStopRef.current();
                  svStopRef.current = null;
                }
                setSvRunning(false);
              }}>
            <Text style={styles.svStopButtonText}>Stop Verification</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  linearGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  messageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  messageCardFlashing: {
    backgroundColor: 'rgba(255, 77, 77, 0.35)',
    borderColor: 'rgba(255, 100, 100, 0.5)',
  },
  appLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
  },
  svPromptContainer: {
    marginTop: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  speechSentenceCard: {
    marginTop: 18,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  speechSentenceLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.65)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  speechSentenceText: {
    fontSize: 17,
    lineHeight: 24,
    color: '#ffffff',
    fontWeight: '500',
  },
  svPromptText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 18,
  },
  svButtonRow: {
    flexDirection: 'row',
    gap: 14,
  },
  svButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  svButtonYes: {
    backgroundColor: '#34C759',
  },
  svButtonNo: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  svButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  svScoreContainer: {
    marginTop: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  svScoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 2,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  svScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 18,
  },
  svScoreItem: {
    alignItems: 'center',
  },
  svScoreItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  svScoreValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  svStopButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  svStopButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default App;
