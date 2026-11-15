/**
 * Where the wake word model comes from: the bundled model, replaced by a newer one from a CDN when there is one.
 *
 * At startup (modelOnStartup) the app checks the CDN for a few seconds before it loads the model; the
 * "Check for model update" button (checkForModelUpdate) checks again and swaps the model without a restart.
 * The download, its SHA-256 check and the on-disk versions are handled by src/modelUpdater.ts.
 *
 * DEMO NOTE: the demo CDN serves a DIFFERENT wake word under the bundled model's file name on purpose: once the
 * download is installed the phrase changes from "Hey Coach" to "Hey Look Deep", so you can hear that the update
 * worked. Put your own model (same file name, plus its .sha256 from scripts/wakeword-model-hash.js) on your CDN
 * and set WAKEWORD_MODEL_CDN_BASE_URL in src/modelUpdater.ts.
 */
import type { KeyWordRNBridgeInstance } from 'react-native-wakeword';
import { DAVOICE_LICENSE, WAKEWORD_BUFFER_COUNT, WAKEWORD_MODEL, WAKEWORD_PHRASE, WAKEWORD_THRESHOLD } from './config';
import { checkForWakewordModelUpdate, syncWakewordModelOnStartup } from './modelUpdater';
import type { WakewordModelUpdateResult } from './modelUpdater';
import { stopListening } from './wakeword';

export type ModelInfo = {
  /** What react-native-wakeword loads: a bundled file name or an absolute path. */
  modelPath: string;
  /** The phrase this model listens for. */
  phrase: string;
  /** Shown in the app ("bundled", "downloaded 3f9a1c2b"). */
  source: string;
};

export const SUPPORTS_MODEL_UPDATES = true;
/** The phrase of the demo CDN's model (see the note above). */
export const DOWNLOADED_PHRASE = 'Hey Look Deep';

const BUNDLED: ModelInfo = { modelPath: WAKEWORD_MODEL, phrase: WAKEWORD_PHRASE, source: 'bundled' };

function infoOf(result: WakewordModelUpdateResult): ModelInfo {
  if (!result.usingDownloadedModel) return BUNDLED;
  return { modelPath: result.modelPath, phrase: DOWNLOADED_PHRASE, source: `downloaded ${(result.sha256 ?? '').slice(0, 8)}`.trim() };
}

/** Startup: a short, silent CDN check; the newest installed model (or the bundled one). */
export async function modelOnStartup(): Promise<ModelInfo> {
  return infoOf(await syncWakewordModelOnStartup({ fileName: WAKEWORD_MODEL }));
}

/** Checks the CDN and, when a newer model was installed, loads it into the running detector. */
export async function checkForModelUpdate(
  instance: KeyWordRNBridgeInstance,
  current: ModelInfo,
): Promise<{ model: ModelInfo; message: string }> {
  const result = await checkForWakewordModelUpdate({ fileName: WAKEWORD_MODEL });
  const next = infoOf(result);
  if (next.modelPath === current.modelPath) {
    const message = {
      updated: 'A new model was installed.',
      up_to_date: 'You already have the latest model.',
      unavailable: 'The CDN could not be reached. Using the current model.',
      failed: `The update failed (${result.reason ?? 'unknown error'}). Using the current model.`,
    }[result.status];
    return { model: current, message };
  }
  await stopListening(instance);
  try {
    await instance.replaceKeywordDetectionModel(next.modelPath, WAKEWORD_THRESHOLD, WAKEWORD_BUFFER_COUNT);
    if (!(await instance.setKeywordDetectionLicense(DAVOICE_LICENSE))) throw new Error('license rejected');
    return { model: next, message: `New model loaded (${next.source}): say “${next.phrase}”.` };
  } catch (error) {
    // the native library rejected the downloaded file: put the bundled model back so detection keeps working
    await instance.replaceKeywordDetectionModel(BUNDLED.modelPath, WAKEWORD_THRESHOLD, WAKEWORD_BUFFER_COUNT);
    await instance.setKeywordDetectionLicense(DAVOICE_LICENSE);
    return { model: BUNDLED, message: `The downloaded model could not be loaded (${String(error)}). Using the bundled model.` };
  }
}
