import { GEMINI_API_KEY } from '../../local.config';
import { llmReplyInstruction } from '../appflow';
import { getTTSLanguage } from '../tts';

export type GeminiChatMessage = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

export type AIChatHistoryMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Local AI Chat: the tool calls and results that came before this reply
   * (see react-native-davoice-llm's runToolTurn). Rendered into later prompts
   * so the model sees that actions are done by calling tools. */
  toolMessages?: { role: 'user' | 'assistant'; content: string }[];
  /** Local AI Chat, a request that ran two operations (core 2026-11-13, Q3): each operation as it ran. Sent back with the history, so the
   * agent replays the request as those turns (the prompt then matches the cached one: no reprocessing on the next turn). */
  operationTurns?: unknown[];
  /** Local AI Chat, command scope IGNORE (core 2026-11-14): speech not meant for the assistant (background talk). Shown as heard, no
   * reply bubble, nothing said, and left out of the history the model sees. */
  ignored?: boolean;
};

export type GeminiRequestLogMeta = {
  requestId: number;
  userText: string;
};

type GeminiTextPartDebug = {
  index: number;
  text: string;
  length: number;
};

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_STREAM_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
export const GEMINI_SYSTEM_PROMPT =
  'You are a helpful voice assistant inside a React Native demo app. Reply conversationally, keep answers concise for spoken playback, and avoid markdown. For time-sensitive facts like current leaders, dates, news, prices, or recent events, answer cautiously and say when you may be unsure rather than asserting a stale fact.';
export const GEMINI_MAX_OUTPUT_TOKENS = 512;
export const GEMINI_THINKING_BUDGET = 256;
/** Gemini's own sampling: independent of the local model's (LocalLLMModelConfig.temperature). */
export const GEMINI_TEMPERATURE = 0.7;
export const AI_CHAT_MIN_REQUEST_GAP_MS = 4000;
export const AI_CHAT_RATE_LIMIT_BACKOFF_MS = 30000;
export const GEMINI_ENABLE_STREAMING = false;
export const AI_CHAT_STRIP_WAKE_WORD_PREFIX = false;

function extractGeminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join(' ')
    .trim();
}

export function normalizeTextForSpeech(text: string): string {
  return text
    // Markdown the TTS would read aloud: list markers, bold/italic, headings.
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/(^|\s)[*_](\S(?:[^*_\n]*\S)?)[*_](?=\s|[.,!?:;]|$)/gm, '$1$2')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n+\s*/g, (match, offset, source) => {
      const before = source.slice(0, offset).trimEnd();
      const after = source.slice(offset + match.length).trimStart();
      const beforeChar = before.slice(-1);
      const afterChar = after.slice(0, 1);
      const hasBoundaryPunctuation = /[.!?,:;]$/.test(before) || /^[.!?,:;]/.test(after);
      return hasBoundaryPunctuation ? ' ' : '. ';
    })
    .replace(/\s+([.!?,:;])/g, '$1')
    .replace(/([.!?,:;]){2,}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** `systemExtra` follows the system prompt (e.g. the remote assistant's role and context, src/aichat/remote.ts). */
function buildGeminiRequestBody(history: GeminiChatMessage[], systemExtra = '', useSearch = true) {
  const system = [GEMINI_SYSTEM_PROMPT, systemExtra, llmReplyInstruction(getTTSLanguage())]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  return {
    system_instruction: {
      parts: [{ text: system }],
    },
    contents: history,
    // Google Search grounding (its quota is separate from the model's).
    ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      thinkingConfig: {
        thinkingBudget: GEMINI_THINKING_BUDGET,
      },
    },
  };
}

function computeStreamDelta(accumulatedText: string, incomingText: string): string {
  if (!incomingText) return '';
  if (!accumulatedText) return incomingText;
  if (incomingText.startsWith(accumulatedText)) {
    return incomingText.slice(accumulatedText.length);
  }
  if (accumulatedText.endsWith(incomingText)) {
    return '';
  }
  return incomingText;
}

export function splitCompletedSentences(text: string): { completed: string[]; remainder: string } {
  const completed: string[] = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?]/.test(text[index])) continue;
    // A period ends a sentence only before a space (or a closing quote): not inside "DaVoice.io", "12.5" or "e.g".
    // At the end of the text so far it may still be followed by more of the word: wait for the next piece.
    if (text[index] === '.') {
      const next = text[index + 1];
      if (next === undefined || !/[\s"')\]]/.test(next)) continue;
    }

    let boundary = index + 1;
    while (boundary < text.length && /["')\]]/.test(text[boundary])) {
      boundary += 1;
    }
    while (boundary < text.length && /\s/.test(text[boundary])) {
      boundary += 1;
    }

    const sentence = text.slice(start, boundary).trim();
    if (sentence) {
      completed.push(sentence);
    }
    start = boundary;
    index = boundary - 1;
  }

  return {
    completed,
    remainder: text.slice(start),
  };
}

export function stripWakeWordPrefix(text: string, wakeWord: string): string {
  const trimmedText = text.trim();
  const wakeWordTokens = wakeWord
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (wakeWordTokens.length === 0) {
    return trimmedText;
  }

  let stripped = trimmedText;
  for (let tokenCount = wakeWordTokens.length; tokenCount >= 1; tokenCount -= 1) {
    const prefix = wakeWordTokens.slice(0, tokenCount).join('\\s+');
    const prefixRegex = new RegExp(`^${prefix}(?:\\s|[,.!?;:])+`, 'i');
    if (prefixRegex.test(stripped)) {
      stripped = stripped.replace(prefixRegex, '').trim();
      break;
    }
  }

  return stripped || trimmedText;
}

export async function generateGeminiReply(
  history: GeminiChatMessage[],
  meta: GeminiRequestLogMeta,
  systemExtra = '',
  useSearch = true,
): Promise<string> {
  const transcriptPreview =
    meta.userText.length > 120 ? `${meta.userText.slice(0, 120)}...` : meta.userText;
  console.log(
    `[AIChat] Gemini request #${meta.requestId} start`,
    {
      model: GEMINI_MODEL,
      historyMessages: history.length,
      transcriptPreview,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      thinkingBudget: GEMINI_THINKING_BUDGET,
    },
  );

  console.log(
    `[AIChat] Gemini request #${meta.requestId} full history`,
    JSON.stringify(history, null, 2),
  );

  const requestBody = buildGeminiRequestBody(history, systemExtra, useSearch);

  console.log(
    `[AIChat] Gemini request #${meta.requestId} request body`,
    JSON.stringify(requestBody, null, 2),
  );

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json();
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const firstCandidate = candidates[0];
  const firstParts = Array.isArray(firstCandidate?.content?.parts)
    ? firstCandidate.content.parts
    : [];
  const groundingMetadata = firstCandidate?.groundingMetadata ?? null;
  const firstPartTexts: GeminiTextPartDebug[] = firstParts.map((part: any, index: number) => {
    const text = typeof part?.text === 'string' ? part.text : '';
    return {
      index,
      text,
      length: text.length,
    };
  });

  console.log(
    `[AIChat] Gemini request #${meta.requestId} raw payload`,
    JSON.stringify(payload, null, 2),
  );
  console.log(
    `[AIChat] Gemini request #${meta.requestId} payload summary`,
    {
      status: response.status,
      candidateCount: candidates.length,
      firstCandidateFinishReason: firstCandidate?.finishReason ?? null,
      firstCandidateTokenCount:
        firstCandidate?.tokenCount ??
        payload?.usageMetadata?.candidatesTokenCount ??
        null,
      firstCandidatePartCount: firstParts.length,
      groundingMetadata,
      usageMetadata: payload?.usageMetadata ?? null,
      promptFeedback: payload?.promptFeedback ?? null,
    },
  );
  console.log(
    `[AIChat] Gemini request #${meta.requestId} first candidate parts`,
    JSON.stringify(firstPartTexts, null, 2),
  );

  if (!response.ok) {
    console.log(
      `[AIChat] Gemini request #${meta.requestId} error`,
      {
        status: response.status,
        transcriptPreview,
      },
    );
    const message =
      payload?.error?.message ||
      `Gemini request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = extractGeminiText(payload);
  console.log(
    `[AIChat] Gemini request #${meta.requestId} extracted text`,
    {
      extractedText: text,
      extractedLength: text.length,
    },
  );
  if (!text) {
    console.log(
      `[AIChat] Gemini request #${meta.requestId} empty response`,
      {
        status: response.status,
        transcriptPreview,
      },
    );
    throw new Error('Gemini returned an empty response.');
  }
  console.log(
    `[AIChat] Gemini request #${meta.requestId} success`,
    {
      status: response.status,
      responseLength: text.length,
    },
  );
  return text;
}

export async function generateGeminiReplyStream(
  history: GeminiChatMessage[],
  meta: GeminiRequestLogMeta,
  onTextDelta: (deltaText: string, aggregateText: string) => void | Promise<void>,
): Promise<{ text: string; usedStreaming: boolean }> {
  const transcriptPreview =
    meta.userText.length > 120 ? `${meta.userText.slice(0, 120)}...` : meta.userText;
  const requestBody = buildGeminiRequestBody(history);

  console.log(
    `[AIChat] Gemini stream request #${meta.requestId} start`,
    {
      model: GEMINI_MODEL,
      historyMessages: history.length,
      transcriptPreview,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      thinkingBudget: GEMINI_THINKING_BUDGET,
      streaming: true,
    },
  );

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let eventBuffer = '';
    let aggregateText = '';
    let processedLength = 0;
    let usedStreaming = false;
    let settled = false;
    let consumeChain = Promise.resolve();

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      try { xhr.abort(); } catch { }
      reject(error);
    };

    const queueConsumeEventBlock = (eventBlock: string) => {
      consumeChain = consumeChain.then(async () => {
        const dataLines = eventBlock
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .filter(Boolean);

        for (const dataLine of dataLines) {
          if (dataLine === '[DONE]') continue;
          const payload = JSON.parse(dataLine);
          const incomingText = extractGeminiText(payload);
          const deltaText = computeStreamDelta(aggregateText, incomingText);
          if (!deltaText) continue;
          aggregateText += deltaText;
          await onTextDelta(deltaText, aggregateText);
        }
      }).catch((error) => {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      });
    };

    const processIncomingText = (chunk: string, markStreaming: boolean) => {
      if (!chunk) return;
      if (markStreaming) {
        usedStreaming = true;
      }
      eventBuffer += chunk.replace(/\r\n/g, '\n');
      let separatorIndex = eventBuffer.indexOf('\n\n');
      while (separatorIndex >= 0) {
        const eventBlock = eventBuffer.slice(0, separatorIndex);
        eventBuffer = eventBuffer.slice(separatorIndex + 2);
        queueConsumeEventBlock(eventBlock);
        separatorIndex = eventBuffer.indexOf('\n\n');
      }
    };

    xhr.open('POST', GEMINI_STREAM_API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-goog-api-key', GEMINI_API_KEY);
    xhr.timeout = 45000;

    xhr.onprogress = () => {
      const responseText = xhr.responseText ?? '';
      if (responseText.length <= processedLength) return;
      const chunk = responseText.slice(processedLength);
      processedLength = responseText.length;
      processIncomingText(chunk, true);
    };

    xhr.onerror = () => {
      settleReject(new Error('Gemini stream XHR network error'));
    };

    xhr.ontimeout = () => {
      settleReject(new Error('Gemini stream XHR timed out'));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === xhr.DONE) {
        const responseText = xhr.responseText ?? '';
        if (responseText.length > processedLength) {
          const chunk = responseText.slice(processedLength);
          processedLength = responseText.length;
          processIncomingText(chunk, false);
        }

        consumeChain.then(() => {
          if (settled) return;
          if (xhr.status < 200 || xhr.status >= 300) {
            settled = true;
            reject(new Error(`Gemini stream HTTP ${xhr.status}: ${xhr.responseText || 'Unknown error'}`));
            return;
          }

          if (eventBuffer.trim()) {
            queueConsumeEventBlock(eventBuffer);
            eventBuffer = '';
          }

          consumeChain.then(() => {
            if (settled) return;
            settled = true;
            resolve({
              text: aggregateText.trim(),
              usedStreaming,
            });
          }).catch((error) => {
            settleReject(error instanceof Error ? error : new Error(String(error)));
          });
        }).catch((error) => {
          settleReject(error instanceof Error ? error : new Error(String(error)));
        });
      }
    };

    xhr.send(JSON.stringify(requestBody));
  });
}

export async function finishAIChatSpeechFlow({
  Speech,
  aiChatStreamingActiveRef,
  aiChatStreamGenerationDoneRef,
  aiChatStreamSpeakingRef,
  aiChatPendingSentenceBufferRef,
  aiChatSpeechQueueRef,
  aiChatAwaitingSpeechFinishRef,
  lastProcessedRef,
  aiChatInFlightRef,
  setIsAIChatLoading,
  resetSpeechTranscriptState,
  setAiChatStatus,
}: any) {
  aiChatStreamingActiveRef.current = false;
  aiChatStreamGenerationDoneRef.current = false;
  aiChatStreamSpeakingRef.current = false;
  aiChatPendingSentenceBufferRef.current = '';
  aiChatSpeechQueueRef.current = [];
  aiChatAwaitingSpeechFinishRef.current = false;
  lastProcessedRef.current = '';
  aiChatInFlightRef.current = false;
  setIsAIChatLoading(false);
  resetSpeechTranscriptState();
  setAiChatStatus('Listening for your next question...');
  console.log('[STT_UNPAUSE_TRACE] before Speech.unPauseSpeechRecognition(-1) in finishAIChatSpeechFlow');
  await Speech.unPauseSpeechRecognition(-1);
  console.log('[STT_UNPAUSE_TRACE] after Speech.unPauseSpeechRecognition(-1) in finishAIChatSpeechFlow');
}

export async function speakNextAIChatSentence({
  Speech,
  speakText,
  aiChatSpeechQueueRef,
  setCurrentSpeechSentence,
  setAiChatStatus,
  getSelectedSpeakerSpeed,
  aiChatStreamGenerationDoneRef,
  aiChatPendingSentenceBufferRef,
  SPEAKER,
  finishAIChatSpeechFlow,
  revealSpokenText,
  aiChatSpeechChainRef,
  aiChatSpeechPendingRef,
  aiChatRequestIdRef,
  speakerLabel = 'Gemini',
}: any) {
  const speak = speakText ?? Speech.speak.bind(Speech);
  const turn = aiChatRequestIdRef?.current;
  const isCurrentTurn = () => !aiChatRequestIdRef || aiChatRequestIdRef.current === turn;
  const finishIfAllSpoken = async () => {
    if (
      isCurrentTurn() &&
      aiChatStreamGenerationDoneRef.current &&
      aiChatSpeechPendingRef.current === 0 &&
      aiChatSpeechQueueRef.current.length === 0 &&
      !aiChatPendingSentenceBufferRef.current.trim()
    ) {
      await finishAIChatSpeechFlow();
    }
  };

  if (aiChatStreamGenerationDoneRef.current) {
    const trailing = aiChatPendingSentenceBufferRef.current.trim();
    aiChatPendingSentenceBufferRef.current = '';
    if (trailing) aiChatSpeechQueueRef.current.push(trailing);
  }

  // Hand every complete sentence to the speech library right away, without
  // waiting for the previous one to finish: the library queues them.
  while (aiChatSpeechQueueRef.current.length > 0) {
    const raw: string = aiChatSpeechQueueRef.current.shift();
    const sentence: string = sentenceRewriter ? sentenceRewriter(raw) : raw;
    const text = normalizeTextForSpeech(sentence);
    if (!text) continue;
    aiChatSpeechPendingRef.current += 1;
    // Resolves when everything queued so far has been spoken.
    const spoken: Promise<void> = Promise.resolve(speak(text, SPEAKER, getSelectedSpeakerSpeed())).catch((error: any) =>
      console.log('[AIChat] speak failed:', error),
    );
    aiChatSpeechChainRef.current = spoken;
    // Show the reply as it is generated, sentence by sentence.
    if (isCurrentTurn()) {
      setCurrentSpeechSentence(`${speakerLabel}: ${sentence}`);
      setAiChatStatus(`Speaking ${speakerLabel} reply...`);
      revealSpokenText?.(sentence);
    }
    void spoken.then(async () => {
      aiChatSpeechPendingRef.current = Math.max(0, aiChatSpeechPendingRef.current - 1);
      await finishIfAllSpoken();
    });
  }
  await finishIfAllSpoken();
}

/** Rewrites a reply sentence before it is spoken (null: as is). Set by the app (2026-11-10: the car demo's bare "Done."). */
let sentenceRewriter: ((sentence: string) => string) | null = null;
export function setAIChatSentenceRewriter(rewrite: ((sentence: string) => string) | null): void {
  sentenceRewriter = rewrite;
}

export async function enqueueAIChatSpeechFromDelta({
  deltaText,
  aggregateText,
  aiChatPendingSentenceBufferRef,
  aiChatSpeechQueueRef,
  speakNextAIChatSentence,
}: any) {
  // The reply text is shown by speakNextAIChatSentence as each sentence goes
  // to TTS, not here as tokens arrive (it would run ahead of the voice).
  aiChatPendingSentenceBufferRef.current += deltaText;
  const { completed, remainder } = splitCompletedSentences(aiChatPendingSentenceBufferRef.current);
  aiChatPendingSentenceBufferRef.current = remainder;
  if (completed.length > 0) {
    aiChatSpeechQueueRef.current.push(...completed);
    await speakNextAIChatSentence();
  }
}

export function resetAIChatSession({
  geminiConversationRef,
  aiChatInFlightRef,
  aiChatAwaitingSpeechFinishRef,
  aiChatRequestIdRef,
  geminiNetworkRequestCountRef,
  lastAIChatSubmitAtRef,
  aiChatBlockedUntilRef,
  lastAIChatSubmittedTextRef,
  aiChatSpeechQueueRef,
  aiChatPendingSentenceBufferRef,
  aiChatStreamingActiveRef,
  aiChatStreamGenerationDoneRef,
  aiChatStreamSpeakingRef,
  setAiChatLiveTranscript,
  setAiChatTranscript,
  setAiChatResponse,
  setAiChatStatus,
  setAiChatMessages,
  setIsAIChatHistoryVisible,
  setIsAIChatLoading,
}: any) {
  //resetSpeechTranscriptState();
  geminiConversationRef.current = [];
  aiChatInFlightRef.current = false;
  aiChatAwaitingSpeechFinishRef.current = false;
  aiChatRequestIdRef.current = 0;
  geminiNetworkRequestCountRef.current = 0;
  lastAIChatSubmitAtRef.current = 0;
  aiChatBlockedUntilRef.current = 0;
  lastAIChatSubmittedTextRef.current = '';
  aiChatSpeechQueueRef.current = [];
  aiChatPendingSentenceBufferRef.current = '';
  aiChatStreamingActiveRef.current = false;
  aiChatStreamGenerationDoneRef.current = false;
  aiChatStreamSpeakingRef.current = false;
  setAiChatLiveTranscript('');
  setAiChatTranscript('');
  setAiChatResponse('');
  setAiChatStatus('Waiting for your voice...');
  setAiChatMessages([]);
  setIsAIChatHistoryVisible(false);
  setIsAIChatLoading(false);
}
