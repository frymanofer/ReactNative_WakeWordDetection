import { createSpeakerVerificationInstance, createSpeakerVerificationMicController, onSpeakerVerificationError, onSpeakerVerificationVerifyResult } from 'react-native-wakeword';
import { getSVUIMatch, SV_DECISION_THRESHOLD } from '../appflow';
import { writeEnrollmentJsonToFile } from './onboarding';

/* New Speaker verification
  // 1) Create instance
  // 2) Create native engine (bundle resource names)
  // 4) Cleanup
*/

export const SV_MATCH_HOLD_MS = 750;

// ✅ NEW: endless/continuous mic verification (FIXED: uses native endless mode)
export async function startEndlessVerificationWithEnrollmentFix(
  enrollmentJson: string,
  setUiMessage: ((s: string) => void) | undefined,
  opts: any,
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
    modelPath: 'sv.dm',
    options: {
      decisionThreshold: SV_DECISION_THRESHOLD,
      //tailSeconds: 2.0,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
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
    try { offR?.(); } catch { }
    try { offE?.(); } catch { }
    try { await ctrl.stop?.(); } catch { }
    try { await ctrl.destroy?.(); } catch { }
    if (!firstDone) {
      firstDone = true;
      try { firstResolve({ stopped: true }); } catch { }
    }
    try { stoppedResolve?.(); } catch { }
  };

  const offE = onSpeakerVerificationError((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;
    console.log('[SVJS-FIX] SV ERROR event:', e);
    setUiMessage?.(`⚠️ SV error: ${e?.error ?? JSON.stringify(e)}`);

    if (!firstDone) {
      firstDone = true;
      try { firstReject(new Error(e?.error ?? 'SV_ERROR')); } catch { }
    }
    stop(); // stop on error
  });

  let matchHoldUntilMs = -1_000_000_000;
  let holdBestScore = Number.NaN;
  let holdScoreHistory: Array<{ timeMs: number; score: number }> = [];

  const offR = onSpeakerVerificationVerifyResult((e) => {
    if (e?.controllerId && e.controllerId !== controllerId) return;

    const best = Number(e?.scoreBest ?? e?.bestScore ?? e?.score ?? NaN);
    const ok = !!e?.isMatch;
    const nowMs = Date.now();
    const hasBest = Number.isFinite(best);
    const wasInHoldWindow = nowMs < matchHoldUntilMs;
    if (ok && !wasInHoldWindow) {
      holdScoreHistory = [];
    }
    if (hasBest && (ok || wasInHoldWindow)) {
      holdScoreHistory.push({ timeMs: nowMs, score: best });
      holdScoreHistory = holdScoreHistory.filter((item) => nowMs - item.timeMs <= matchHoldMs);
    }
    if (ok) {
      matchHoldUntilMs = nowMs + matchHoldMs;
    }
    const inHoldWindow = nowMs < matchHoldUntilMs;
    holdBestScore = inHoldWindow && holdScoreHistory.length > 0
      ? Math.max(...holdScoreHistory.map((item) => item.score))
      : Number.NaN;

    const showAsMatch = ok || inHoldWindow;
    const scoreToShow = showAsMatch && Number.isFinite(holdBestScore) ? holdBestScore : best;
    const uiShowAsMatch = getSVUIMatch(scoreToShow, showAsMatch);
    console.log('[SVJS-FIX] SV VERIFY:', e);
    setUiMessage?.(`🔐 Speaker Identificaiton Match=${uiShowAsMatch ? '✅' : '❌'}`);
    //setUiMessage?.(`🔐 SV(best=${Number.isFinite(scoreToShow) ? scoreToShow.toFixed(3) : 'n/a'}) match=${showAsMatch ? '✅' : '❌'}`);
    onScore?.(scoreToShow, uiShowAsMatch);

    if (!firstDone) {
      firstDone = true;
      try { firstResolve(e); } catch { }
    }

    // Native endless mode keeps emitting; only stop here if requested.
    if (stopOnMatch && ok) stop();
  });

  setUiMessage?.(`🎙️ Verify Speaker Identification Now`);//  (hop=${hopSeconds}s)`);

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
  }

  return stop;
}

// ✅ NEW: mic-verify helper (THIS is what your code was calling)
export async function verifyFromMicWithEnrollment(
  enrollmentJson: string,
  setUiMessage?: (s: string) => void
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] verifyFromMicWithEnrollment: enrollmentJson is missing');
  }

  const micConfig = {
    modelPath: 'sv.dm',
    options: {
      decisionThreshold: SV_DECISION_THRESHOLD,
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
    try { await ctrl.stop?.(); } catch { }
    try { await ctrl.destroy?.(); } catch { }
  }
}

export async function runVerificationWithEnrollment(
  enrollmentJson: string,
  setUiMessage?: (s: string) => void
) {
  if (!enrollmentJson || typeof enrollmentJson !== 'string') {
    throw new Error('[SVJS] runVerificationWithEnrollment: enrollmentJson is missing');
  }

  const micConfig = {
    modelPath: 'sv.dm',
    options: {
      decisionThreshold: SV_DECISION_THRESHOLD,
      tailSeconds: 2.0,
      frameSize: 1280,
      maxTailSeconds: 3.0,
      cmn: true,
      expectedLayoutBDT: false,
    },
  };

  // 1) Persist enrollmentJson so native can load it like a normal file
  const enrollmentPath = await writeEnrollmentJsonToFile(enrollmentJson, 'davoice_enrollment_runtime.json');

  // 2) Create a SpeakerVerification engine instance (NOT the mic controller)
  const sv = await createSpeakerVerificationInstance('svVerify1');
  await sv.create(
    micConfig.modelPath,
    enrollmentPath,               // <-- IMPORTANT: use the file path we just wrote
    micConfig.options
  );

  /*
  // ---------- (A) Verify WAV files ----------
  const wavs = [
    '1.wav',
    '2.wav',
    '3.wav',
    '4.wav',
    '5.wav',
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
*/
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
