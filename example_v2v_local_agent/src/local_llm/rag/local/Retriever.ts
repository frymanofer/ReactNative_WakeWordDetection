/**
 * Stub. Pairs with Ingestor.ts — local_llm.md Stage 9, deferred. Always
 * returns no passages until a real local RAG backend exists.
 */
export async function retrieve(
  _speakerId: string,
  _query: string,
  _topK: number = 5,
): Promise<string[]> {
  return [];
}
