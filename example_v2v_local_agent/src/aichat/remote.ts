import type { AgentRemoteRequest } from 'react-native-davoice-llm';

import { generateGeminiReply, normalizeTextForSpeech } from './index';
import type { GeminiChatMessage } from './index';
import { LOCAL_LLM_LAYER2, LOCAL_LLM_NO_REMOTE_MESSAGE, LOCAL_LLM_NOT_IN_DEMO_MESSAGE } from '../local_llm/constants';
import { DID_NOT_CATCH, isTooShortForDecline } from './fragments';
import { getTTSLanguage } from '../tts';

// The remote assistant of Local AI Chat's DaVoice Agent model: Gemini (the
// same model, key and Google Search grounding as AI Chat) answers what the
// small model on the phone hands over: time-sensitive questions, small talk,
// questions about the user, knowledge, long writing (agent.json "remote").
// The agent says a filler meanwhile and speaks the answer as the reply. Any
// failure is reported as {failure, detail}: the agent tells the user what went
// wrong (agent.json "remote.errors"), never a guess from the phone.

const REMOTE_ROLE =
  "You are the online helper of an assistant that runs on the user's phone. You cannot do anything on the " +
  "phone (no logging, timers, messages or settings): if asked to, say you can't do that. Reply only to the " +
  "user's last message, in one to four short spoken sentences.";

let nextRemoteRequestId = 100001;

type RemoteFailure = 'offline' | 'busy' | 'unavailable' | 'failed';

/** Which kind of failure a Gemini error is, for the sentence the user hears. */
function failureKind(message: string): RemoteFailure {
  if (/network request failed|network|internet|offline|timed? ?out|unable to resolve|connection/i.test(message)) return 'offline';
  // Quota, billing, key or setup: Gemini can't be used now ("unavailable").
  if (/quota|billing|credits|depleted|plan|api key|leaked|permission|denied|invalid|not found|\b(400|401|402|403|404)\b/i.test(message)) return 'unavailable';
  if (/\b(429|500|502|503|504)\b|rate|exhausted|overloaded|busy|unavailable|try again/i.test(message)) return 'busy';
  return 'failed';
}

/** Google Search grounding has its own quota: when it is used up, ask again without it. */
function isSearchQuotaError(error: any): boolean {
  return /quota|exhausted|rate/i.test(String(error?.message ?? error));
}

export async function answerRemoteRequest(
  request: AgentRemoteRequest,
): Promise<{ text: string } | { failure: RemoteFailure; detail: string }> {
  // The model said it can't do this (remote.cannotReplies, reason "cannot"): not available in this demo.
  if (request.reason === 'cannot') {
    const language = getTTSLanguage();
    // A fragment of speech the model declined is noise, not an unsupported feature (2026-11-10 phone: "Alma Alma.").
    if (isTooShortForDecline(request.userText ?? request.query ?? '')) {
      console.log('[AIChat][REMOTE] declined fragment: asking to repeat');
      return { text: DID_NOT_CATCH[language] ?? DID_NOT_CATCH.en };
    }
    console.log('[AIChat][REMOTE] not available in this demo (the model declined)');
    return { text: LOCAL_LLM_NOT_IN_DEMO_MESSAGE[language] ?? LOCAL_LLM_NOT_IN_DEMO_MESSAGE.en };
  }
  // No remote model set up (constants.ts LOCAL_LLM_LAYER2 'none'): say so instead of answering.
  if (LOCAL_LLM_LAYER2 === 'none') {
    const language = getTTSLanguage();
    console.log(`[AIChat][REMOTE] no remote model set up (reason ${request.reason ?? '-'}): telling the user`);
    return { text: LOCAL_LLM_NO_REMOTE_MESSAGE[language] ?? LOCAL_LLM_NO_REMOTE_MESSAGE.en };
  }
  try {
    return await askGemini(request);
  } catch (error: any) {
    const detail = String(error?.message ?? error);
    const failure = failureKind(detail);
    console.log(`[AIChat][REMOTE] failed (${failure}): ${detail}`);
    return { failure, detail };
  }
}

async function askGemini(request: AgentRemoteRequest): Promise<{ text: string }> {
  const context: string[] = [];
  if (request.date) context.push(`Today is ${request.date}.`);
  const known = [...(request.facts ?? []), request.memory ?? ''].map((line) => line.trim()).filter(Boolean);
  if (known.length > 0) context.push(`What the assistant knows about the user:\n${known.join('\n')}`);
  // E.g. the calorie total the user asked for: Gemini words the answer.
  const results = (request.toolResults ?? []).filter((r) => r.ok && r.call?.name !== 'handoff_remote');
  if (results.length > 0) {
    const json = JSON.stringify(results.map((r) => ({ tool: r.call.name, result: r.result })));
    context.push(`What the phone's tools returned for this request (answer from it):\n${json}`);
  }

  // Gemini wants the turns to alternate, starting with the user.
  const contents: GeminiChatMessage[] = [];
  const add = (role: GeminiChatMessage['role'], text: string) => {
    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts[0].text += `\n${text}`;
    else if (contents.length > 0 || role === 'user') contents.push({ role, parts: [{ text }] });
  };
  for (const message of request.history ?? []) {
    const text = (message.text ?? '').trim();
    if (text) add(message.role === 'user' ? 'user' : 'model', text);
  }
  const userText = request.userText || request.query;
  add('user', userText);

  console.log(`[AIChat][REMOTE] (${request.reason}) "${userText}"`);
  const system = [REMOTE_ROLE, ...context].join('\n\n');
  let reply: string;
  try {
    reply = await generateGeminiReply(contents, { requestId: nextRemoteRequestId++, userText }, system);
  } catch (error) {
    if (!isSearchQuotaError(error)) throw error;
    console.log('[AIChat][REMOTE] search grounding quota used up: asking again without Google Search');
    reply = await generateGeminiReply(contents, { requestId: nextRemoteRequestId++, userText }, system, false);
  }
  return { text: normalizeTextForSpeech(reply) };
}
