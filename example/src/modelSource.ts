/**
 * Where the wake word model comes from. In this example: the model bundled with the app.
 * (example_loading_remote_model replaces this file with one that downloads newer models from a CDN.)
 */
import type { KeyWordRNBridgeInstance } from 'react-native-wakeword';
import { WAKEWORD_MODEL, WAKEWORD_PHRASE } from './config';

export type ModelInfo = {
  /** What react-native-wakeword loads: a bundled file name or an absolute path. */
  modelPath: string;
  /** The phrase this model listens for. */
  phrase: string;
  /** Shown in the app ("bundled", "downloaded 3f9a1c2b"). */
  source: string;
};

export const SUPPORTS_MODEL_UPDATES = false;

export async function modelOnStartup(): Promise<ModelInfo> {
  return { modelPath: WAKEWORD_MODEL, phrase: WAKEWORD_PHRASE, source: 'bundled' };
}

/** Not used in this example (no remote models). */
export async function checkForModelUpdate(
  _instance: KeyWordRNBridgeInstance,
  current: ModelInfo,
): Promise<{ model: ModelInfo; message: string }> {
  return { model: current, message: 'This example uses the bundled model only.' };
}
