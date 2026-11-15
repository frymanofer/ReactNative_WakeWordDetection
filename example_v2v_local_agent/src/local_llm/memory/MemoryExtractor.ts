import type { ChatMessage } from '../types';
import type { MemoryFact } from './LongTermMemoryStore';

/**
 * Stub: candidate-fact extraction from a conversation turn. Deferred per
 * local_llm.md Stage 10 — a real implementation would run a short LLM
 * summarization prompt (via the same LocalLLMEngine, not a separate model)
 * over recent turns and ask it to emit candidate facts worth remembering.
 * Returns nothing until that exists.
 */
export function extractCandidateFacts(
  _speakerId: string,
  _turn: ChatMessage,
): MemoryFact[] {
  return [];
}
