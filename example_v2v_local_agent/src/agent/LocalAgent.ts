import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { Agent } from 'react-native-davoice-llm';
import type { AgentApprovalRequest, AgentConfig, AgentEvent, AgentRemoteRequest } from 'react-native-davoice-llm';

import { agentPackFor, automotiveAgentFor } from './AgentPack';
import { currentLocalDemo } from '../local_llm/demo';
import { ownerMayAct } from '../speaker_verification/currentSpeaker';
import { answerRemoteRequest } from '../aichat/remote';
import { llmReplyInstruction } from '../appflow';
import { getTTSLanguage } from '../tts';
// Local AI Chat's web search engine and API keys, from the git-ignored
// local.config.ts: WEB_SEARCH_ENGINE = 'wikipedia' (default, no key) |
// 'tavily' | 'brave', plus TAVILY_API_KEY / BRAVE_API_KEY; USDA_API_KEY for
// the calorie demo's food lookup. All optional.
import * as LocalConfig from '../../local.config';

// Local AI Chat's assistant: the shared native agent core (the same one the
// Flutter example uses), driven by the agent pack in example/agent/. It
// decides when to search the web, says fillers while waiting, routes calorie
// requests to the tracker's tools, builds the prompt and runs the model. The
// calorie log and food list live in its SQLite database.

const config = LocalConfig as {
  WEB_SEARCH_ENGINE?: 'wikipedia' | 'tavily' | 'brave';
  TAVILY_API_KEY?: string;
  BRAVE_API_KEY?: string;
  USDA_API_KEY?: string;
};

function agentSettings(): AgentConfig {
  const usdaApiKey = config.USDA_API_KEY?.trim();
  const language = getTTSLanguage();
  const pack = agentPackFor(language);
  // The car demo (src/local_llm/demo.ts): the automotive pack, no calorie skill, its own database.
  const car = currentLocalDemo() === 'car';
  const agent = car ? automotiveAgentFor(language) : pack.agent;
  // The reply language (from the language screen) ends the persona, so it is
  // part of the cached system prompt and the same in every turn and prefill.
  const systemPrompt = `${agent.persona.systemPrompt} ${llmReplyInstruction(language)}`.trim();
  const dbName = `${language === 'en' ? 'davoice_agent' : `davoice_agent_${language.replace('-', '_').toLowerCase()}`}${car ? '_car' : ''}`;
  return {
    pack: {
      agent: { ...agent, persona: { ...agent.persona, systemPrompt } },
      skills: car ? [] : [{ skill: pack.caloriesSkill, data: { 'foods.json': pack.caloriesFoods } }],
    },
    // One database per language (and demo): it holds the food list (seeded from the
    // pack's foods.json), the calorie log, memories and what the router learned.
    databasePath: `${RNFS.DocumentDirectoryPath}/${dbName}.db`,
    // The whole chat (user, model outputs, tools, replies), readable off the
    // phone even when the Xcode console drops lines.
    chatLogPath: `${RNFS.DocumentDirectoryPath}/davoice_chat.log`,
    webSearch: {
      engine: config.WEB_SEARCH_ENGINE ?? 'wikipedia',
      tavilyApiKey: config.TAVILY_API_KEY,
      braveApiKey: config.BRAVE_API_KEY,
    },
    // Foods missing from the list are looked up on Wikipedia, and first on
    // USDA FoodData Central when USDA_API_KEY is set.
    skillSettings: {
      calories: {
        sources: usdaApiKey ? [{ type: 'usda', apiKey: usdaApiKey }, { type: 'wikipedia' }] : [{ type: 'wikipedia' }],
      },
    },
  };
}

// The router's sentence-embedding model (all-MiniLM-L6-v2, 25 MB): the agent
// decides what a turn needs (web search, a calorie tool, neither) by
// comparing the user's words with example sentences. Downloaded once; until
// then the router compares words directly.
const EMBEDDING_MODEL_URL =
  'https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF/resolve/main/all-MiniLM-L6-v2-Q8_0.gguf';
const EMBEDDING_MODEL_PATH = `${RNFS.DocumentDirectoryPath}/models/all-MiniLM-L6-v2-Q8_0.gguf`;

async function setUpRouterEmbeddings(agent: Agent): Promise<void> {
  try {
    if (!(await RNFS.exists(EMBEDDING_MODEL_PATH))) {
      await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/models`);
      const tmp = `${EMBEDDING_MODEL_PATH}.download`;
      const { promise } = RNFS.downloadFile({ fromUrl: EMBEDDING_MODEL_URL, toFile: tmp, background: true });
      const result = await promise;
      if (result.statusCode !== 200) throw new Error(`HTTP ${result.statusCode}`);
      await RNFS.moveFile(tmp, EMBEDDING_MODEL_PATH);
    }
    await agent.configure({ router: { embeddingModel: EMBEDDING_MODEL_PATH } });
    console.log('[DavoiceAgent] router embedding model set');
  } catch (error) {
    console.log('[DavoiceAgent] router embedding model not available (word overlap is used):', error);
  }
}

const listeners = new Set<(event: AgentEvent) => void>();
let agentPromise: Promise<Agent> | null = null;

/** The app's one agent, created on first use (after the language screen). */
/** Permission scopes this app grants to tools that declare "authorization" (e.g. "payments", "door_locks").
 * Everything else is refused: the core never runs such a tool without a yes. */
const AUTHORIZED_TOOL_SCOPES = new Set<string>([]);

function isToolAuthorized(request: AgentApprovalRequest): boolean {
  // Doors (unlock_car, open_door): only the enrolled owner's voice, when speaker verification is on.
  if (request.scope === 'door_locks') {
    const owner = ownerMayAct();
    console.log(`[DavoiceAgent] authorize ${request.name} (scope "door_locks"): ${owner.allowed ? 'yes' : 'no'} - ${owner.reason}`);
    return owner.allowed;
  }
  const ok = AUTHORIZED_TOOL_SCOPES.has(request.scope);
  console.log(`[DavoiceAgent] authorize ${request.name} (scope "${request.scope}"): ${ok ? 'yes' : 'no'}`);
  return ok;
}

/** Tools that declare "confirmation": a plain dialog. Dismissing it is a no. */
function askToConfirm(request: AgentApprovalRequest): Promise<boolean> {
  const args = Object.entries(request.arguments ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join('\n');
  return new Promise((resolve) => {
    Alert.alert(
      request.message || `Run "${request.name}"?`,
      [request.description, args].filter(Boolean).join('\n\n'),
      [
        { text: 'No', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Yes', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function getLocalAgent(): Promise<Agent> {
  agentPromise ??= Agent.create(agentSettings(), {
    onEvent: (event) => {
      if (event.type === 'log') console.log(`[DavoiceAgent] ${event.level}: ${event.message}`);
      for (const listener of [...listeners]) listener(event);
    },
    // The remote assistant (Gemini) for models that hand over to it (see
    // LocalLLMModelConfig.remoteAssistant).
    onRequest: async (request) => {
      if (request.type === 'remote') return answerRemoteRequest(request as AgentRemoteRequest);
      if (request.type === 'authorizeTool') return { authorized: isToolAuthorized(request as AgentApprovalRequest) };
      if (request.type === 'confirmTool') return { confirmed: await askToConfirm(request as AgentApprovalRequest) };
      throw new Error(`The app does not answer "${request.type}" requests.`);
    },
  }).then((agent) => {
    void setUpRouterEmbeddings(agent); // in the background: turns work meanwhile
    return agent;
  }).catch((error) => {
    agentPromise = null;
    throw error;
  });
  return agentPromise;
}

/** Closes the agent so the next use creates it with the current demo's pack (a demo switch). */
export async function resetLocalAgent(): Promise<void> {
  const pending = agentPromise;
  agentPromise = null;
  if (!pending) return;
  try {
    await (await pending).close();
  } catch (error) {
    console.log('[LocalAgent] close on demo switch failed:', String(error));
  }
}

/** Every agent event (e.g. the calorie log's `skill` changes); returns an
 * unsubscribe function. */
export function onLocalAgentEvent(listener: (event: AgentEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
