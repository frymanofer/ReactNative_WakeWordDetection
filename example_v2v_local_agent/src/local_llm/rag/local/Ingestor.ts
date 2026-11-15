/**
 * Stub. Local RAG (ingesting the user's own docs/history) is local_llm.md
 * Stage 9, deferred until Stages 1-8 are device-tested. A real
 * implementation ingests text into local storage (SQLite + FTS5, per the
 * plan) and computes embeddings via the bundled multilingual-e5-small `.dm`
 * asset referenced by the model pack's `embeddingModel` field.
 */
export async function ingest(_speakerId: string, _text: string, _sourceId: string): Promise<void> {
  // no-op
}
