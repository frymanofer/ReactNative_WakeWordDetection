import type { MemoryFact } from './LongTermMemoryStore';
import { listFacts, writeFacts } from './LongTermMemoryStore';

/** The "what's worth persisting" gate — the memory-management layer the
 * scaffolding plan called out explicitly. Sits in front of
 * LongTermMemoryStore so nothing writes facts directly; this is where a
 * quality/dedup/cap policy lives. Real (not a stub): a naive
 * cap-and-drop-oldest policy, sufficient until something smarter (dedup by
 * similarity, importance scoring) is needed. */

export interface MemoryPolicy {
  maxFactsPerSpeaker: number;
}

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
  maxFactsPerSpeaker: 200,
};

export async function considerPersisting(
  speakerId: string,
  candidates: MemoryFact[],
  policy: MemoryPolicy = DEFAULT_MEMORY_POLICY,
): Promise<void> {
  if (candidates.length === 0) return;

  const existing = await listFacts(speakerId);
  const merged = [...existing, ...candidates].sort((a, b) => a.createdAt - b.createdAt);

  const trimmed =
    merged.length > policy.maxFactsPerSpeaker
      ? merged.slice(merged.length - policy.maxFactsPerSpeaker)
      : merged;

  await writeFacts(speakerId, trimmed);
}
