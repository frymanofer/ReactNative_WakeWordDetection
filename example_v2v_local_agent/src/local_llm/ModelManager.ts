import RNFS from 'react-native-fs';
import type { LocalLLMModelConfig, ModelId } from './types';
import { LOCAL_LLM_STORAGE_DIR } from './constants';

// Real download/cache logic (same RNFS.downloadFile pattern already
// documented for this feature in local_llm.md's Stage 4) — only the actual
// URLs come from the model registry (ModelRegistry.ts). Downloads land under the
// app's documents directory, never inside the app bundle: the GGUF must
// never ship in the binary (~1-5GB) and must never be committed to any repo.

function modelsDir(): string {
  return `${RNFS.DocumentDirectoryPath}/${LOCAL_LLM_STORAGE_DIR}/models`;
}

export function getModelPath(model: LocalLLMModelConfig): string {
  return `${modelsDir()}/${model.filename}`;
}

export async function isModelDownloaded(model: LocalLLMModelConfig): Promise<boolean> {
  return RNFS.exists(getModelPath(model));
}

export async function deleteModel(model: LocalLLMModelConfig): Promise<void> {
  const path = getModelPath(model);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

/**
 * In-flight download per model id, so concurrent callers join the same
 * transfer instead of starting a second one to the same destination file.
 *
 * A naive `if (await RNFS.exists(dest)) return;` guard (still present below,
 * as the cheap common-case fast path) is not enough on its own: two callers
 * can both pass that check — file not there yet — before either has started
 * writing, and both then call `RNFS.downloadFile` against the same `dest`.
 * Concurrent writers streaming into one destination corrupt it. This is the
 * same "load/download at most once" fix documented for `LocalLLMLoader.ts`'s
 * `ensureModelLoaded`, applied one layer down to the download itself (see the
 * AmigoLocal `loadModel`/`modelLoadRef` writeup in memory for the reference
 * case this pattern is copied from).
 */
const inFlightDownloads = new Map<ModelId, Promise<void>>();

/**
 * Downloads the GGUF for `model` if it isn't already cached. Deliberately
 * does NOT delete a different, already-downloaded model variant — see
 * "storage" note in the scaffolding plan: the default policy (keep at most
 * one GGUF resident) belongs in the app-flow code that calls this, not here,
 * so a caller that wants to keep both variants around can.
 */
export async function downloadModel(
  model: LocalLLMModelConfig,
  onProgress?: (fractionComplete: number) => void,
): Promise<void> {
  const existing = inFlightDownloads.get(model.id);
  if (existing) return existing;

  const download = downloadModelOnce(model, onProgress).finally(() => {
    // Always clear, success or failure: a completed download shouldn't stay
    // "in flight" (the isModelDownloaded()/exists() fast path takes over),
    // and a failed one must be retryable.
    inFlightDownloads.delete(model.id);
  });
  inFlightDownloads.set(model.id, download);
  return download;
}

async function downloadModelOnce(
  model: LocalLLMModelConfig,
  onProgress?: (fractionComplete: number) => void,
): Promise<void> {
  const dir = modelsDir();
  const dest = getModelPath(model);

  if (await RNFS.exists(dest)) return;

  const dirExists = await RNFS.exists(dir);
  if (!dirExists) {
    await RNFS.mkdir(dir);
  }

  const tmpDest = `${dest}.download`;
  const { promise } = RNFS.downloadFile({
    fromUrl: model.url,
    toFile: tmpDest,
    // Required on iOS even though the result is ignored here: iOS's
    // downloader only records the status code and content length inside its
    // `begin` branch, and gates every `progress` callback on statusCode ==
    // 200. Without a `begin` handler that gate is never satisfied and
    // progress silently never fires (found the hard way in a sibling app —
    // see the AmigoLocal `modelStore.ts` writeup in memory).
    begin: () => {},
    progress: onProgress
      ? (res) => {
          if (res.contentLength > 0) {
            onProgress(res.bytesWritten / res.contentLength);
          }
        }
      : undefined,
    // Time-based throttling (~10fps), not `progressDivider`'s percent-based
    // throttling: a multi-GB file only crosses ~30 whole-percent boundaries
    // total, which is too coarse for a smooth progress bar.
    progressInterval: 100,
  });

  const result = await promise;
  if (result.statusCode !== 200) {
    await RNFS.unlink(tmpDest).catch(() => undefined);
    throw new Error(`Model download failed for ${model.displayName}: HTTP ${result.statusCode}`);
  }

  // A cut-off or wrong file would otherwise load as a broken model.
  if (model.sha256) {
    const hash = (await RNFS.hash(tmpDest, 'sha256')).toLowerCase();
    if (hash !== model.sha256.toLowerCase()) {
      await RNFS.unlink(tmpDest).catch(() => undefined);
      throw new Error(`Model download failed for ${model.displayName}: checksum mismatch`);
    }
  }

  // Never clobber a model that is already on disk: the exists() check above
  // and this in-flight-download map should already prevent two transfers to
  // the same dest, but stay defensive in case something outside this module
  // wrote it in the meantime.
  if (await RNFS.exists(dest)) {
    await RNFS.unlink(tmpDest).catch(() => undefined);
    onProgress?.(1);
    return;
  }

  await RNFS.moveFile(tmpDest, dest);
  onProgress?.(1);
}

/**
 * Deletes `.gguf` files in the models directory that no registered model uses
 * any more (e.g. after a built-in model switched quantization, or a custom
 * model was removed without deleting its file). Partial downloads are kept.
 */
/**
 * Where the model's saved KV-cache state lives (react-native-davoice-llm saveState/loadState): the processed system
 * prompt, restored at the next start instead of ~40 s of prompt processing on a phone CPU. Keyed by the model file
 * (name + sha256 / size) and context size: a state is only valid for the exact weights and window it was made with.
 */
export function kvStatePath(model: LocalLLMModelConfig, promptKey?: string): string {
  return `${modelsDir()}/${kvStatePrefix(model)}${promptKey ? `${promptKey}.` : ''}kvstate`;
}

/** Where the pre-warmed state for `language` (LocalLLMModelConfig.prebuiltStates) is stored: the same prefix as the model's own saved
 * states, so the newest-2-per-model cleanup treats it as one of them. */
export function prebuiltStatePath(model: LocalLLMModelConfig, language: string): string {
  return `${modelsDir()}/${kvStatePrefix(model)}prebuilt-${language}.kvstate`;
}

const inFlightStateDownloads = new Map<string, Promise<string | null>>();

/**
 * Downloads the pre-warmed state of `language` for `model` if the model has one and it isn't on disk yet (sha256 checked; a failure only
 * logs: the phone then warms up itself). Resolves to the file's path, or null when there is none.
 */
export function downloadPrebuiltState(
  model: LocalLLMModelConfig,
  language: string,
  onProgress?: (fractionComplete: number) => void,
): Promise<string | null> {
  const entry = model.prebuiltStates?.[language];
  if (!entry) return Promise.resolve(null);
  const dest = prebuiltStatePath(model, language);
  const running = inFlightStateDownloads.get(dest);
  if (running) return running;
  const job = (async () => {
    if (await RNFS.exists(dest)) return dest;
    if (!entry.url) return null;   // not hosted yet (a copied-in file above is still used)
    if (!(await RNFS.exists(modelsDir()))) await RNFS.mkdir(modelsDir());
    // The phone already saved its own state for this language (states are named "<lang>-<prompt hash>"): no 400 MB download.
    const own = `${kvStatePrefix(model)}${language}-`;
    if ((await RNFS.readDir(modelsDir())).some((e) => e.name.startsWith(own) && e.name.endsWith('.kvstate'))) return null;
    const tmp = `${dest}.download`;
    const { promise } = RNFS.downloadFile({
      fromUrl: entry.url,
      toFile: tmp,
      begin: () => {},   // iOS needs a begin handler for progress (see downloadModelOnce)
      progress: onProgress ? (res) => { if (res.contentLength > 0) onProgress(res.bytesWritten / res.contentLength); } : undefined,
      progressInterval: 100,
    });
    const result = await promise;
    if (result.statusCode !== 200) {
      await RNFS.unlink(tmp).catch(() => undefined);
      throw new Error(`pre-warmed state download failed: HTTP ${result.statusCode}`);
    }
    const hash = (await RNFS.hash(tmp, 'sha256')).toLowerCase();
    if (hash !== entry.sha256.toLowerCase()) {
      await RNFS.unlink(tmp).catch(() => undefined);
      throw new Error('pre-warmed state download failed: checksum mismatch');
    }
    if (await RNFS.exists(dest)) await RNFS.unlink(tmp).catch(() => undefined);
    else await RNFS.moveFile(tmp, dest);
    onProgress?.(1);
    return dest;
  })()
    .catch((error) => {
      console.log('[LocalLLM] pre-warmed state not downloaded (the phone warms up itself):', error);
      return null;
    })
    .finally(() => inFlightStateDownloads.delete(dest));
  inFlightStateDownloads.set(dest, job);
  return job;
}

/** File-name prefix shared by every saved state of this model (one per prompt: language, tools, wording). */
function kvStatePrefix(model: LocalLLMModelConfig): string {
  const key = (model.sha256 ?? String(model.sizeBytes ?? 0)).slice(0, 12);
  return `${model.filename}.${key}.ctx${model.contextSize}.`;
}

/**
 * Which saved state fits this prompt: a hash of its system part (persona, language, tools) WITHOUT the date line, which changes
 * every day. Two languages or tool wordings then keep two states instead of overwriting one (each switch cost ~32-40 s of prompt
 * processing on the S20); a new day still restores the state and only the part after the date is processed again.
 */
export function stablePromptKey(prompt: string, dateText: string): string {
  const userAt = prompt.indexOf('<|im_start|>user');
  const system = (userAt >= 0 ? prompt.slice(0, userAt) : prompt).split(dateText).join('');
  let h = 0x811c9dc5;   // FNV-1a, 32 bits
  for (let i = 0; i < system.length; i++) {
    h ^= system.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const KV_STATES_PER_MODEL = 2;

export async function deleteUnusedModelFiles(models: LocalLLMModelConfig[]): Promise<string[]> {
  const dir = modelsDir();
  if (!(await RNFS.exists(dir))) return [];
  const inUse = new Set(models.map((m) => m.filename));
  // Saved states: each model keeps its newest KV_STATES_PER_MODEL (one per prompt variant, ~470 MB each); others and states of
  // removed models are deleted.
  const prefixes = models.map(kvStatePrefix);
  const deleted: string[] = [];
  const entries = await RNFS.readDir(dir);
  const states = entries
    .filter((e) => e.isFile() && (e.name.endsWith('.kvstate') || e.name.endsWith('.kvstate.tmp')))
    .sort((x, y) => (y.mtime?.getTime() ?? 0) - (x.mtime?.getTime() ?? 0));
  const kept = new Map<string, number>();
  for (const entry of states) {
    const prefix = prefixes.find((p) => entry.name.startsWith(p));
    const n = prefix ? (kept.get(prefix) ?? 0) : Infinity;
    if (prefix && !entry.name.endsWith('.tmp') && n < KV_STATES_PER_MODEL) {
      kept.set(prefix, n + 1);
      continue;
    }
    await RNFS.unlink(entry.path);
    deleted.push(entry.name);
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.gguf') && !inUse.has(entry.name)) {
      await RNFS.unlink(entry.path);
      deleted.push(entry.name);
    }
  }
  return deleted;
}
