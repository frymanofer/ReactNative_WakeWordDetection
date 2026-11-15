import RNFS from 'react-native-fs';
import { LOCAL_LLM_STORAGE_DIR } from '../constants';

/** A durable fact about a user, extracted from past conversation. Keyed to
 * the speaker ID already produced by src/speaker_verification/ — no separate
 * identity infrastructure needed (per local_llm.md Stage 10). */
export interface MemoryFact {
  id: string;
  speakerId: string;
  text: string;
  createdAt: number;
  sourceTurnId?: string;
}

// RNFS-JSON-backed this pass (one file per speaker, not SQLite yet) — real
// enough to prove the seam works; swap for a real store (SQLite, or
// something queryable) once fact volume actually warrants it.

function factsPath(speakerId: string): string {
  const safeId = speakerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${RNFS.DocumentDirectoryPath}/${LOCAL_LLM_STORAGE_DIR}/memory/${safeId}.json`;
}

export async function listFacts(speakerId: string): Promise<MemoryFact[]> {
  const path = factsPath(speakerId);
  if (!(await RNFS.exists(path))) return [];
  try {
    const raw = await RNFS.readFile(path, 'utf8');
    return JSON.parse(raw) as MemoryFact[];
  } catch {
    return [];
  }
}

export async function writeFacts(speakerId: string, facts: MemoryFact[]): Promise<void> {
  const path = factsPath(speakerId);
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
  await RNFS.writeFile(path, JSON.stringify(facts), 'utf8');
}
