import type { LocalLLMModelConfig, ModelId } from './types';
import { downloadModel, getModelPath, isModelDownloaded } from './ModelManager';

// Untyped, lazy require — deliberately not a static `import` and not
// `typeof import(...)` either: `react-native-davoice-llm` isn't a dependency
// of this app yet (see the scaffolding plan — TTSLLM exists as a sibling
// repo, not yet installed here), and this file must still type-check on its
// own. Mirrors the same shape used in src/aichat/provider.ts. Its real API
// is TTSLLM/local_llm/index.ts's exports.
interface LocalLLMBridgeModule {
  setLicense: (licenseKey: string) => Promise<boolean>;
  loadLayer2Model: (path: string, options?: { contextSize?: number; useMmap?: boolean }) => Promise<void>;
  loadModel: (
    path: string,
    options?: {
      contextSize?: number;
      nGpuLayers?: number;
      useMlock?: boolean;
      useMmap?: boolean;
      cacheTypeK?: 'f16' | 'q8_0' | 'q4_0';
      cacheTypeV?: 'f16' | 'q8_0' | 'q4_0';
    },
  ) => Promise<void>;
}

function localLLMBridge(): LocalLLMBridgeModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-davoice-llm');
}

export interface LocalLLMLoadOptions {
  contextSize?: number;
  nGpuLayers?: number;
  useMlock?: boolean;
  /** Defaults to `true`. See TTSLLM/local_llm/index.ts's
   * `LoadModelOptions.useMmap` doc comment before ever passing `false`. */
  useMmap?: boolean;
  cacheTypeK?: 'f16' | 'q8_0' | 'q4_0';
  cacheTypeV?: 'f16' | 'q8_0' | 'q4_0';
}

/**
 * The model currently loaded (or loading) in the native engine, and that
 * load's promise, so concurrent callers join one load instead of each calling
 * the native `loadModel` independently.
 *
 * This is the direct analog of the `loadModel`/`modelLoadRef` pattern found
 * in the AmigoLocal reference app (see memory): `loadModel` there is
 * reachable from several UI call sites, and a plain `isModelLoaded &&
 * llama`-style state guard reads stale state under concurrent/re-entrant
 * calls — two callers racing before the first commits its "loaded" state
 * both see "not loaded" and both call the native load, mapping the same
 * multi-hundred-MB-to-multi-GB GGUF twice. On a phone the second copy is
 * what pushes the process into swap. A module-level latch set synchronously
 * (not via React state) closes that window.
 *
 * The native engine holds exactly one model (its `loadModel` unloads the
 * previous one), so this tracks a single active model rather than one latch
 * per model: switching models in the picker replaces the latch, and
 * switching back loads the earlier model again.
 */
let activeModelId: ModelId | null = null;
let activeLoad: Promise<void> | null = null;
let activeLoadDone = false;

/**
 * Ensures `model` is downloaded and loaded into the native engine, calling
 * the native `setLicense`/`loadModel` **at most once** per model even under
 * concurrent callers. A different model than the active one replaces it,
 * after any in-progress load has settled. Failed attempts clear the latch so
 * a retry (e.g. after a license/network error) can try again; call
 * `resetModelLoadLatch` after `unloadModel()`.
 *
 * Call this between chat turns, never while a generation is streaming:
 * replacing the model frees the one the generation is using.
 */
export async function ensureModelLoaded(
  model: LocalLLMModelConfig,
  licenseKey: string,
  options?: LocalLLMLoadOptions,
  onDownloadProgress?: (fractionComplete: number) => void,
): Promise<void> {
  if (activeLoad && activeModelId === model.id) return activeLoad;

  const previous = activeLoad;
  activeLoadDone = false;
  // Assigned before the async body first reads it (after its first await).
  let load!: Promise<void>;
  load = (async () => {
    if (previous) await previous.catch(() => undefined);
    await ensureModelLoadedOnce(model, licenseKey, options, onDownloadProgress);
    if (activeLoad === load) activeLoadDone = true;
    console.log(`[LocalLLM] "${model.displayName}" ready=${activeLoadDone}`);
  })().catch((error) => {
    if (activeLoad === load) {
      activeLoad = null;
      activeModelId = null;
    }
    throw error;
  });
  activeModelId = model.id;
  activeLoad = load;
  return load;
}

async function ensureModelLoadedOnce(
  model: LocalLLMModelConfig,
  licenseKey: string,
  options?: LocalLLMLoadOptions,
  onDownloadProgress?: (fractionComplete: number) => void,
): Promise<void> {
  if (!(await isModelDownloaded(model))) {
    await downloadModel(model, onDownloadProgress);
  }

  console.log(`[LocalLLM] loading "${model.displayName}"`);
  const bridge = localLLMBridge();
  const licensed = await bridge.setLicense(licenseKey);
  if (!licensed) {
    throw new Error(`Local LLM license was rejected for model "${model.displayName}"`);
  }

  await bridge.loadModel(getModelPath(model), {
    contextSize: options?.contextSize ?? model.contextSize,
    nGpuLayers: options?.nGpuLayers,
    useMlock: options?.useMlock,
    // Always explicit, never omitted: see LocalLLMLoadOptions.useMmap's doc
    // comment (and TTSLLM/local_llm/index.ts's, and LocalLLMEngine.swift's) —
    // llama.rn's load_mode derives use_mmap/use_mlock from an AUTO default
    // before overrides apply, so passing useMlock without useMmap silently
    // resolves load_mode to NONE, defeating mmap entirely.
    useMmap: options?.useMmap ?? true,
    cacheTypeK: options?.cacheTypeK,
    cacheTypeV: options?.cacheTypeV,
  });
  nativeLoads++;
  console.log(`[LocalLLM] native load done for "${model.displayName}"`);
}

// Native loads so far: each starts with an empty KV cache (src/aichat/provider.ts restores the saved state once per load).
let nativeLoads = 0;
export function nativeLoadCount(): number {
  return nativeLoads;
}

/** The model the native engine has (or is loading), if any. */
export function getActiveModelId(): ModelId | null {
  return activeModelId;
}

/** True once `modelId` has finished loading and is the engine's active model. */
export function isModelReady(modelId: ModelId): boolean {
  return activeLoadDone && activeModelId === modelId;
}

/** Call after `unloadModel()` so the next `ensureModelLoaded()` loads again. */
export function resetModelLoadLatch(): void {
  activeLoad = null;
  activeModelId = null;
  activeLoadDone = false;
}

/**
 * The layer 2 model (constants.ts LOCAL_LLM_LAYER2_MODEL): downloaded if needed and loaded next to the
 * main model, at most once even under concurrent callers. Call after `ensureModelLoaded` (it sets the
 * license). A failure clears the latch, so the next call tries again.
 */
let layer2Load: Promise<void> | null = null;
let layer2Ready = false;

export function ensureLayer2Loaded(model: LocalLLMModelConfig): Promise<void> {
  if (layer2Load) return layer2Load;
  const load = (async () => {
    if (!(await isModelDownloaded(model))) {
      console.log(`[LocalLLM] downloading the layer 2 model "${model.displayName}"`);
      await downloadModel(model);
    }
    const started = Date.now();
    await localLLMBridge().loadLayer2Model(getModelPath(model), { contextSize: model.contextSize, useMmap: true });
    layer2Ready = true;
    console.log(`[LocalLLM] layer 2 model "${model.displayName}" loaded in ${Date.now() - started} ms`);
  })().catch((error) => {
    layer2Load = null;
    console.log('[LocalLLM] layer 2 model not loaded:', error);
    throw error;
  });
  layer2Load = load;
  return load;
}

export function isLayer2Ready(): boolean {
  return layer2Ready;
}
