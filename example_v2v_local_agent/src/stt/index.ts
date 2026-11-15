import { DeviceEventEmitter, Platform } from 'react-native';
import { noteSpeechResult } from '../speaker_verification/currentSpeaker';

// === minimal coalescer that PRESERVES punctuation ===

// ASCII word spans (safe for your English prompts). If you need full Unicode,
// swap the regex to /\p{L}+\p{M}*|\p{N}+/gu (ensure your JS engine supports it).
export const _wordSpans = (s: string) => {
  const spans: Array<{ w: string; start: number; end: number }> = [];
  const re = /[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    spans.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return spans;
};

export const _stripPunc = (s: string) =>
  (s || '').toLowerCase().replace(/[^A-Za-z0-9\s]+/g, '').replace(/\s+/g, ' ').trim();

export const _overlapCount = (aWords: string[], bWords: string[]) => {
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

export const mergeSmartKeepPunct = (prev: string, curr: string, minOverlap = 2) => {
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

export function getAdjustedSpeed(text: string, baseSpeed: number): number {
  /*const wordCount = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount <= 4) {
    return baseSpeed * 0.5;
  }

  if (wordCount <= 8) {
    return baseSpeed * 0.8;
  }
*/
  return baseSpeed;
}

let _androidSttSubs: any[] = [];

export function registerSpeechHandlers({
  Speech,
  speakText,
  suppressAndroidPartialResultsRef,
  showAppModePrompt,
  isTTSTestMode,
  isSpeakerVerificationActive,
  isAwaitingWakeWord,
  isSpeechResultsAllowed,
  isSTTOnlyMode,
  setLastSentSentence,
  aiChatInFlightRef,
  speechSessionUIAllowedRef,
  setIsSpeechSessionActive,
  lastTranscriptRef,
  lastPartialTimeRef,
  setCurrentSpeechSentence,
  setAiChatLiveTranscript,
  timeoutRef,
  isFullAIChatMode,
  lastProcessedRef,
  processAIChatTurn,
  beginSpeechUiEpoch,
  setCurrentSpeechSentenceGuarded,
  getSelectedSpeakerSpeed,
  SPEAKER,
  resetSpeechTranscriptState,
  sleep,
  clearSpeechSentenceUI,
  silenceThresholdMsRef,
  setAiChatTranscript,
}: any) {
  const speak = speakText ?? Speech.speak.bind(Speech);
  // Speech handlers (kept)
  Speech.onSpeechError = async (e: any) => {
    console.log('onSpeechError error ignored: ', e);
    if (String(e?.error?.code) === '11' || e?.error?.message === 'Unknown error') {
      console.log('onSpeechError error 11', e);
    } else if (e?.error?.code === '7' || e?.error?.message === 'No match') {
      console.log('onSpeechError error 7', e);
      //await Speech.start('en-US');
    }
  };

  Speech.onSpeechStart = async () => {
    console.log('onSpeechStart: Speech started');
    if (!speechSessionUIAllowedRef.current) {
      console.log('onSpeechStart: ignored for UI because no speech-session screen is active');
      return;
    }
    setIsSpeechSessionActive(true);
  };

  Speech.onSpeechEnd = async () => {
    console.log('***Sentence ended***:', lastTranscriptRef.current);
    // Keep AIChat-like behavior: do not clear timeout or reset transcript here.
    // Timeout lifecycle is handled by onSpeechPartialResults/onSpeechResults.
    return;
  };

  Speech.onSpeechPartialResults = (e: any) => {
    console.log('onSpeechPartialResults: 1');
    noteSpeechResult(e); // who is speaking (owner-only car actions)

    if (Platform.OS === 'android' && suppressAndroidPartialResultsRef.current) {
      console.log('[STT_INIT_GUARD] ignoring Android partial result while speech library is still loading/pause is settling', e.value?.[0]);
      return;
    }

    if (!isSpeechResultsAllowed || showAppModePrompt || isTTSTestMode || isSpeakerVerificationActive || isAwaitingWakeWord || aiChatInFlightRef.current) return;
    const curr = e.value?.[0];
    if (Platform.OS === 'ios') {
      if (curr && curr !== lastTranscriptRef.current) {
        lastTranscriptRef.current = curr;
        lastPartialTimeRef.current = Date.now();
        setCurrentSpeechSentence(curr);
        setAiChatLiveTranscript(curr);
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
    const merged = mergeSmartKeepPunct(lastTranscriptRef.current, curr, 2);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const newText = lastTranscriptRef.current.trim();
      if (!newText || aiChatInFlightRef.current) return;
      if (isFullAIChatMode) {
        if (newText === lastProcessedRef.current) return;
        console.log('[AIChat] silence timeout reached, sending:', newText);
        await processAIChatTurn(newText);
        return;
      }

      if (isSTTOnlyMode) {
        setLastSentSentence(newText);
        resetSpeechTranscriptState();
        clearSpeechSentenceUI();
        return;
      }

      const speechUiEpoch = beginSpeechUiEpoch();
      console.log('⏳ Silence timeout reached, speaking:', lastTranscriptRef.current);
      console.log('🗣️ Speaking:', newText);
      setCurrentSpeechSentenceGuarded(speechUiEpoch, "Speaking now:" + newText);
      await Speech.pauseSpeechRecognition();
      const adjustedSpeed = getAdjustedSpeed(newText, getSelectedSpeakerSpeed());
      await speak(newText, SPEAKER, adjustedSpeed);
      resetSpeechTranscriptState();
      console.log('[STT_UNPAUSE_TRACE] before Speech.unPauseSpeechRecognition(-1) in onSpeechPartialResults silence timeout');
      await Speech.unPauseSpeechRecognition(-1);
      console.log('[STT_UNPAUSE_TRACE] after Speech.unPauseSpeechRecognition(-1) in onSpeechPartialResults silence timeout');
      await sleep(300);
      clearSpeechSentenceUI(speechUiEpoch);
    }, silenceThresholdMsRef.current);

    if (merged === lastTranscriptRef.current) return;

    lastTranscriptRef.current = merged;
    setCurrentSpeechSentence(merged);
    setAiChatLiveTranscript(merged);
    console.log('Partial:', merged);
  };

  Speech.onSpeechResults = async (e: any) => {
    console.log('onSpeechResults: 1 ');
    noteSpeechResult(e);

    if (!isSpeechResultsAllowed || showAppModePrompt || isTTSTestMode || isSpeakerVerificationActive || isAwaitingWakeWord || aiChatInFlightRef.current) {
      console.log('onSpeechResults: leaving?????? ');
      return;
    }

    const current = e.value?.[0]?.trim();

    if (Platform.OS === 'android') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('Results: ', e.value?.[0]);
      if (current) {
        lastTranscriptRef.current = mergeSmartKeepPunct(lastTranscriptRef.current, current, 2);
        setCurrentSpeechSentence(lastTranscriptRef.current);
        setAiChatLiveTranscript(lastTranscriptRef.current);
        setAiChatTranscript(lastTranscriptRef.current);
      }
      timeoutRef.current = setTimeout(async () => {
        const newText = lastTranscriptRef.current.trim();
        if (!newText || aiChatInFlightRef.current) return;
        if (isFullAIChatMode) {
          if (newText === lastProcessedRef.current) return;
          console.log('[AIChat] silence timeout reached, sending:', newText);
          await processAIChatTurn(newText);
          return;
        }
        if (isSTTOnlyMode) {
          setLastSentSentence(newText);
          resetSpeechTranscriptState();
          clearSpeechSentenceUI();
          return;
        }
        await speak(newText, SPEAKER, getSelectedSpeakerSpeed());
      }, silenceThresholdMsRef.current);
      return;
    }

    console.log('Results: ', e.value?.[0]);
    if (!current || current === lastTranscriptRef.current) return;
    setCurrentSpeechSentence(current);
    setAiChatLiveTranscript(current);
    setAiChatTranscript(current);
    lastTranscriptRef.current = current;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const newText = lastTranscriptRef.current.trim();
      if (!newText || aiChatInFlightRef.current) return;
      if (isFullAIChatMode) {
        if (newText === lastProcessedRef.current) return;
        console.log('[AIChat] silence timeout reached, sending:', newText);
        await processAIChatTurn(newText);
        return;
      }

      const speechUiEpoch = beginSpeechUiEpoch();
      console.log('⏳ Silence timeout reached, speaking:', lastTranscriptRef.current);
      console.log('🗣️ Speaking:', newText);
      setCurrentSpeechSentenceGuarded(speechUiEpoch, 'Speaking now:' + newText);
      await Speech.pauseSpeechRecognition();
      const adjustedSpeed = getAdjustedSpeed(newText, getSelectedSpeakerSpeed());
      await speak(newText, SPEAKER, adjustedSpeed);
      resetSpeechTranscriptState();
      console.log('[STT_UNPAUSE_TRACE] before Speech.unPauseSpeechRecognition(-1) in onSpeechResults silence timeout');
      await Speech.unPauseSpeechRecognition(-1);
      console.log('[STT_UNPAUSE_TRACE] after Speech.unPauseSpeechRecognition(-1) in onSpeechResults silence timeout');
      await sleep(300);
      clearSpeechSentenceUI(speechUiEpoch);
    }, silenceThresholdMsRef.current);
  };

  // Android: DaVoice STT emits events via DeviceEventEmitter, not NativeEventEmitter.
  // Subscribe here as a fallback so speech events always reach JS regardless of emitter path.
  if (Platform.OS === 'android') {
    _androidSttSubs.forEach(sub => { try { sub.remove(); } catch {} });
    _androidSttSubs = [];
    const sttEventNames = ['onSpeechStart', 'onSpeechEnd', 'onSpeechError', 'onSpeechResults', 'onSpeechPartialResults'] as const;
    sttEventNames.forEach(name => {
      const sub = DeviceEventEmitter.addListener(name, (e: any) => {
        const handler = (Speech as any).handlers?.[name];
        if (typeof handler === 'function') handler(e);
      });
      _androidSttSubs.push(sub);
    });
  }
}
