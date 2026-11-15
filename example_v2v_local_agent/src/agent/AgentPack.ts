// The agent pack: Local AI Chat's behavior as data, in example/agent/ (the
// Flutter example ships the same files); example/agent/pt-BR/ is the same pack
// for Brazilian Portuguese (what the user hears in Portuguese, Portuguese words
// in the patterns, the same instructions to the model). agent.json holds the persona, prompt
// templates, web-search rules and filler phrases; each skill folder holds a
// skill's tools, routing rules, messages and data (skills/calories/foods.json).
// The native agent core interprets them (see LocalAgent.ts); the types below
// document their shape. Change behavior by editing the files.

import type { ToolChoice } from 'react-native-davoice-llm';

import type { AppLanguage } from '../appflow';

/** Regex patterns are strings, matched case-insensitively. */
type Pattern = string;

export interface AgentConfig {
  version: number;
  persona: { systemPrompt: string };
  prompts: { currentDate: string; webResults: string; webResultLine: string; webSearchFailed: string };
  webSearch: {
    rules: {
      timeWords: Pattern;
      newsy: Pattern;
      recentYear: Pattern;
      whoRuns: Pattern;
      officeWords: Pattern;
      whoQuestion: Pattern;
      yesNoQuestion: Pattern;
      asksWho: Pattern;
    };
    officePages: {
      fixed: Array<{ pattern: Pattern; page: string }>;
      offices: Array<{ pattern: Pattern; title: string }>;
      places: Array<{ pattern: Pattern; name: string }>;
      whoRunsPages: Record<string, string>;
      placeAfterOf: Pattern;
      defaultPlaces: Record<string, string>;
      neutralQuestion: string;
    };
    fillers: {
      topicProbability: number;
      general: string[];
      topics: Array<{ pattern: Pattern; fillers: string[] }>;
      searchFailed: string[];
    };
  };
  onlineToolFillers: string[];
}

/** A routing rule matches when every `all` pattern matches, at least one
 * `any` pattern matches (if given) and no `none` pattern matches. */
export interface RoutingRule {
  comment?: string;
  all?: Pattern[];
  any?: Pattern[];
  none?: Pattern[];
  choice: ToolChoice;
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CaloriesSkillConfig {
  id: string;
  instructions: string;
  missingToolReply: string;
  routing: { rules: RoutingRule[]; default: ToolChoice };
  tools: ToolSpec[];
  matching: {
    foodStopWords: Pattern;
    servingWords: string[];
    notFoodWords: string[];
    lastEntry: Pattern;
    grams: Pattern;
    justCalories: Pattern;
  };
  onlineLookup: { timeoutMs: number; fillers: string[] };
  messages: Record<string, string>;
}

export interface FoodsSeed {
  version: number;
  description?: string;
  foods: Array<{ name: string; calories: number }>;
}

export interface AgentPackFiles {
  agent: AgentConfig;
  caloriesSkill: CaloriesSkillConfig;
  caloriesFoods: FoodsSeed;
}

const englishAgentPack: AgentPackFiles = {
  agent: require('../../agent/agent.json'),
  caloriesSkill: require('../../agent/skills/calories/skill.json'),
  caloriesFoods: require('../../agent/skills/calories/foods.json'),
};

const agentPacks: Partial<Record<AppLanguage, AgentPackFiles>> = {
  en: englishAgentPack,
  'pt-BR': {
    agent: require('../../agent/pt-BR/agent.json'),
    caloriesSkill: require('../../agent/pt-BR/skills/calories/skill.json'),
    caloriesFoods: require('../../agent/pt-BR/skills/calories/foods.json'),
  },
};

/** The Automotive Agent's pack (agent_automotive/: the app pack without the calorie skill, the prompt the automotive model is
 * trained with; 2026-11-10). */
const automotivePacks: Partial<Record<AppLanguage, AgentConfig>> = {
  en: require('../../agent_automotive/agent.json'),
  'pt-BR': require('../../agent_automotive/pt-BR/agent.json'),
};

export function automotiveAgentFor(language: AppLanguage): AgentConfig {
  return automotivePacks[language] ?? automotivePacks.en!;
}

/** The agent pack of the app's language. */
export function agentPackFor(language: AppLanguage): AgentPackFiles {
  // Translated agent data is currently available for English and pt-BR. The
  // language instruction still makes every supported language reply in the
  // selected language while the shared skill data remains English.
  return agentPacks[language] ?? englishAgentPack;
}
