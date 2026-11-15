/**
 * Wake word model updates from a CDN (example app).
 *
 * The app ships `hey_coach_model_28_22012026b.dm` as a native asset
 * (android/app/src/main/assets on Android, the app bundle on iOS). That copy is the
 * fallback. A newer copy downloaded from the CDN is stored under the app's documents
 * directory and its absolute path is handed to react-native-wakeword instead of the
 * bare file name.
 *
 * Both platforms accept an absolute model path (iOS since react-native-wakeword 1.1.144). If the native
 * library ever rejects a downloaded model, src/modelSource.ts puts the bundled model back.
 *
 * On-disk layout (inside RNFS.DocumentDirectoryPath):
 *
 *   wakeword_models/manifest.json                what is installed + last remote metadata
 *   wakeword_models/<sha256 prefix>/<file>.dm    one directory per model version
 *   wakeword_models/tmp/                         in-progress downloads
 *
 * Every version gets its own directory so the native `.dm` unpack cache can never serve
 * a stale extraction after an update.
 *
 * How "is there a newer version?" is answered (static files only, no API calls):
 *
 *   1. GET  <cdn>/<file>.dm.sha256   tiny sidecar text file holding the model's SHA-256
 *                                    (create it with `node scripts/wakeword-model-hash.js`)
 *   2. HEAD <cdn>/<file>.dm          ETag / Last-Modified / Content-Length, used only when
 *                                    the sidecar is missing
 *
 * Whatever is downloaded is hashed and compared with the model already in use before it is
 * installed, so a CDN that serves unchanged bytes never triggers a swap. All network and file
 * errors are swallowed and logged; callers get a status, never an exception.
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

/** Base URL of the CDN that hosts the `.dm` model and its `.sha256` sidecar. */
export const WAKEWORD_MODEL_CDN_BASE_URL = 'https://pub-fa06ba558cd447a38e86d0d4cf3e6786.r2.dev';
/** Suffix of the sidecar hash file: `<model>.dm.sha256`. */
export const WAKEWORD_MODEL_HASH_SUFFIX = '.sha256';
/** Directory (inside the documents directory) that holds downloaded models. */
export const WAKEWORD_MODELS_DIR_NAME = 'wakeword_models';
/** Total time the startup check may take before the app continues without it. */
export const WAKEWORD_UPDATE_STARTUP_TIMEOUT_MS = 15000;
/** Total time a user-initiated check may take. */
export const WAKEWORD_UPDATE_MANUAL_TIMEOUT_MS = 60000;

const MANIFEST_FILE_NAME = 'manifest.json';
const MANIFEST_VERSION = 1;
const TMP_DIR_NAME = 'tmp';
const VERSION_DIR_NAME_LENGTH = 12;
const MIN_STEP_TIMEOUT_MS = 1500;
const LOG_TAG = '[WakewordModelUpdate]';
const SHA256_PATTERN = /\b[a-fA-F0-9]{64}\b/;
const NO_CACHE_HEADERS: { [name: string]: string } = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

export type WakewordModelUpdateStatus =
  /** A newer model was downloaded, verified, and installed. */
  | 'updated'
  /** The CDN serves the same model the app already uses. Nothing changed. */
  | 'up_to_date'
  /** The CDN could not be reached or gave no hash/metadata. Nothing changed. */
  | 'unavailable'
  /** The download or its verification failed. Nothing changed. */
  | 'failed';

export interface WakewordModelUpdateResult {
  status: WakewordModelUpdateStatus;
  fileName: string;
  /** What to hand to react-native-wakeword: an absolute path (downloaded) or the bare file name (bundled). */
  modelPath: string;
  usingDownloadedModel: boolean;
  /** SHA-256 of the model in use, when known. */
  sha256: string | null;
  /** Short diagnostic for logs; never shown to the user. */
  reason?: string;
}

export interface WakewordModelUpdateOptions {
  /** Bare model file name, e.g. `hey_coach_model_28_22012026b.dm`. */
  fileName: string;
  /** Overall budget for the whole check (network + download). */
  timeoutMs?: number;
  /** Called once when a download actually starts (lets the UI show a status line). */
  onDownloadStart?: () => void;
}

interface RemoteMetadata {
  etag: string | null;
  lastModified: string | null;
  contentLength: number | null;
}

interface ActiveModelRecord {
  sha256: string;
  /** Relative to the models directory, e.g. `3f9a1c2b7d4e/hey_coach_model_28_22012026b.dm`. */
  relativePath: string;
  installedAt: string;
}

interface WakewordModelManifest {
  version: number;
  fileName: string;
  active: ActiveModelRecord | null;
  remote: (RemoteMetadata & { checkedAt: string }) | null;
}

const log = (...args: unknown[]) => console.log(LOG_TAG, ...args);

export const getWakewordModelCdnUrl = (fileName: string): string =>
  `${WAKEWORD_MODEL_CDN_BASE_URL.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`;

export const getWakewordModelsDir = (): string =>
  `${RNFS.DocumentDirectoryPath}/${WAKEWORD_MODELS_DIR_NAME}`;

const getTmpDir = () => `${getWakewordModelsDir()}/${TMP_DIR_NAME}`;
const getManifestPath = () => `${getWakewordModelsDir()}/${MANIFEST_FILE_NAME}`;
const toAbsoluteModelPath = (relativePath: string) => `${getWakewordModelsDir()}/${relativePath}`;
const versionDirNameFor = (sha256: string) => sha256.slice(0, VERSION_DIR_NAME_LENGTH);
const nowIso = () => new Date().toISOString();

const emptyManifest = (fileName: string): WakewordModelManifest => ({
  version: MANIFEST_VERSION,
  fileName,
  active: null,
  remote: null,
});

const isActiveRecord = (value: unknown): value is ActiveModelRecord => {
  const record = value as Partial<ActiveModelRecord> | null | undefined;
  return (
    !!record &&
    typeof record.sha256 === 'string' &&
    typeof record.relativePath === 'string' &&
    !record.relativePath.includes('..')
  );
};

async function readManifest(fileName: string): Promise<WakewordModelManifest> {
  try {
    const manifestPath = getManifestPath();
    if (!(await RNFS.exists(manifestPath))) {
      log('manifest: none on disk at', manifestPath, '-> bundled model, no remote metadata');
      return emptyManifest(fileName);
    }
    const parsed = JSON.parse(
      await RNFS.readFile(manifestPath, 'utf8'),
    ) as Partial<WakewordModelManifest>;
    if (parsed.version !== MANIFEST_VERSION || parsed.fileName !== fileName) {
      log('manifest: version/fileName mismatch, ignoring it', {
        version: parsed.version,
        fileName: parsed.fileName,
        expectedVersion: MANIFEST_VERSION,
        expectedFileName: fileName,
      });
      return emptyManifest(fileName);
    }
    const manifest = {
      version: MANIFEST_VERSION,
      fileName,
      active: isActiveRecord(parsed.active) ? parsed.active : null,
      remote: parsed.remote ?? null,
    };
    log('manifest: loaded', JSON.stringify(manifest));
    return manifest;
  } catch (error) {
    log('manifest unreadable, starting clean:', error);
    return emptyManifest(fileName);
  }
}

async function writeManifest(manifest: WakewordModelManifest): Promise<void> {
  await RNFS.mkdir(getWakewordModelsDir());
  await RNFS.writeFile(getManifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
  log('manifest: written', getManifestPath(), JSON.stringify(manifest));
}

async function writeManifestSafe(manifest: WakewordModelManifest): Promise<void> {
  try {
    await writeManifest(manifest);
  } catch (error) {
    log('manifest write failed (ignored):', error);
  }
}

async function safeUnlink(path: string): Promise<void> {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch (error) {
    log('unlink failed (ignored):', path, error);
  }
}

/** Remove every version directory except `keepDirName` (the tmp dir is always kept). */
async function removeOtherVersionDirs(keepDirName: string | null): Promise<void> {
  try {
    const dir = getWakewordModelsDir();
    if (!(await RNFS.exists(dir))) return;
    for (const entry of await RNFS.readDir(dir)) {
      if (!entry.isDirectory() || entry.name === TMP_DIR_NAME || entry.name === keepDirName) {
        continue;
      }
      log('cleanup: removing old model version dir', entry.path);
      await safeUnlink(entry.path);
    }
  } catch (error) {
    log('cleanup failed (ignored):', error);
  }
}

/**
 * Absolute path of the installed CDN model, or the bare file name when none is installed
 * (react-native-wakeword then loads the bundled asset exactly as before). Never throws.
 */
export async function getActiveWakewordModelPath(fileName: string): Promise<string> {
  try {
    log('getActiveWakewordModelPath: resolving model for', fileName);
    const manifest = await readManifest(fileName);
    if (manifest.active) {
      const absolutePath = toAbsoluteModelPath(manifest.active.relativePath);
      if (await RNFS.exists(absolutePath)) {
        log('getActiveWakewordModelPath: using DOWNLOADED model', absolutePath, 'sha256', manifest.active.sha256);
        return absolutePath;
      }
      log('installed model is missing on disk; using the bundled model');
    }
  } catch (error) {
    log('getActiveWakewordModelPath failed; using the bundled model:', error);
  }
  log('getActiveWakewordModelPath: using BUNDLED model', fileName);
  return fileName;
}

async function hashFile(path: string): Promise<string | null> {
  try {
    const started = Date.now();
    const sha = (await RNFS.hash(path, 'sha256')).toLowerCase();
    log('hash:', path, '->', sha, `(${Date.now() - started}ms)`);
    return sha;
  } catch (error) {
    log('hash failed:', path, error);
    return null;
  }
}

/** SHA-256 of the model shipped inside the app, or null when it cannot be read. */
async function hashBundledModel(fileName: string): Promise<string | null> {
  try {
    log('bundled model: hashing the copy shipped in the app', fileName);
    if (Platform.OS === 'ios') {
      const bundledPath = `${RNFS.MainBundlePath}/${fileName}`;
      const exists = await RNFS.exists(bundledPath);
      log('bundled model (ios):', bundledPath, exists ? 'exists' : 'NOT FOUND');
      return exists ? hashFile(bundledPath) : null;
    }
    if (Platform.OS === 'android') {
      // Assets live inside the APK; copy to a temp file to hash it.
      const exists = await RNFS.existsAssets(fileName);
      log('bundled model (android asset):', fileName, exists ? 'exists' : 'NOT FOUND');
      if (!exists) return null;
      const tmpPath = `${getTmpDir()}/${fileName}.bundled`;
      await RNFS.mkdir(getTmpDir());
      await safeUnlink(tmpPath);
      await RNFS.copyFileAssets(fileName, tmpPath);
      try {
        return await hashFile(tmpPath);
      } finally {
        await safeUnlink(tmpPath);
      }
    }
  } catch (error) {
    log('bundled model hash failed:', error);
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** `<model>.dm.sha256`: the first 64-hex token wins, so plain `sha256sum` output works as-is. */
async function fetchRemoteSha256(url: string, timeoutMs: number): Promise<string | null> {
  try {
    log('step 1: GET sidecar hash', url, `timeout ${timeoutMs}ms`);
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: NO_CACHE_HEADERS },
      timeoutMs,
    );
    if (!response.ok) {
      log('sidecar hash not available: HTTP', response.status);
      return null;
    }
    const body = await response.text();
    const match = body.match(SHA256_PATTERN);
    if (!match) {
      log('sidecar file holds no sha256; body was:', JSON.stringify(body.slice(0, 200)));
      return null;
    }
    log('step 1: remote sha256 =', match[0].toLowerCase());
    return match[0].toLowerCase();
  } catch (error) {
    log('sidecar hash fetch failed:', error);
    return null;
  }
}

async function fetchRemoteMetadata(url: string, timeoutMs: number): Promise<RemoteMetadata | null> {
  try {
    log('step 2: HEAD model (no sidecar hash)', url, `timeout ${timeoutMs}ms`);
    const response = await fetchWithTimeout(
      url,
      { method: 'HEAD', headers: NO_CACHE_HEADERS },
      timeoutMs,
    );
    if (!response.ok) {
      log('HEAD not available: HTTP', response.status);
      return null;
    }
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const contentLengthHeader = response.headers.get('content-length');
    const contentLength =
      contentLengthHeader && /^\d+$/.test(contentLengthHeader) ? Number(contentLengthHeader) : null;
    if (!etag && !lastModified && contentLength == null) {
      log('step 2: HEAD returned no etag/last-modified/content-length');
      return null;
    }
    log('step 2: HEAD metadata', { etag, lastModified, contentLength });
    return { etag: etag ?? null, lastModified: lastModified ?? null, contentLength };
  } catch (error) {
    log('HEAD failed:', error);
    return null;
  }
}

const sameRemoteMetadata = (a: RemoteMetadata, b: RemoteMetadata): boolean =>
  a.etag === b.etag && a.lastModified === b.lastModified && a.contentLength === b.contentLength;

async function downloadToFile(
  url: string,
  toFile: string,
  timeoutMs: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let jobId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  try {
    log('step 3: download starting', url, '->', toFile, `timeout ${timeoutMs}ms`);
    const job = RNFS.downloadFile({
      fromUrl: url,
      toFile,
      headers: NO_CACHE_HEADERS,
      connectionTimeout: Math.min(timeoutMs, 15000),
      readTimeout: timeoutMs,
      background: false,
      discretionary: false,
      begin: (info) => log('step 3: download begin', { statusCode: info.statusCode, contentLength: info.contentLength }),
    });
    jobId = job.jobId;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`download timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    const result = await Promise.race([job.promise, timeout]);
    log('step 3: download finished', { statusCode: result.statusCode, bytesWritten: result.bytesWritten }, `(${Date.now() - started}ms)`);
    if (result.statusCode !== 200) return { ok: false, reason: `HTTP ${result.statusCode}` };
    const stat = await RNFS.stat(toFile);
    log('step 3: downloaded file size on disk', stat.size);
    if (!(Number(stat.size) > 0)) return { ok: false, reason: 'empty download' };
    return { ok: true };
  } catch (error) {
    log('step 3: download failed', String(error), `(${Date.now() - started}ms)`);
    if (jobId != null) {
      try {
        RNFS.stopDownload(jobId);
      } catch {}
    }
    return { ok: false, reason: String(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const inFlight = new Map<string, Promise<WakewordModelUpdateResult>>();

/**
 * Check the CDN and install a newer model if there is one. Concurrent calls for the same
 * file share one run. Resolves with a status; it does not throw.
 */
export function checkForWakewordModelUpdate(
  options: WakewordModelUpdateOptions,
): Promise<WakewordModelUpdateResult> {
  const running = inFlight.get(options.fileName);
  if (running) {
    log('checkForWakewordModelUpdate: a check is already running for', options.fileName, '- reusing it');
    return running;
  }
  log('checkForWakewordModelUpdate: starting', options.fileName, `timeout ${options.timeoutMs ?? WAKEWORD_UPDATE_MANUAL_TIMEOUT_MS}ms`);
  const run = runUpdateCheck(options).finally(() => {
    inFlight.delete(options.fileName);
  });
  inFlight.set(options.fileName, run);
  return run;
}

/**
 * Startup variant: time-boxed by WAKEWORD_UPDATE_STARTUP_TIMEOUT_MS, silent, never throws.
 * Call it before the wake word instance is created so a new model is loaded right away.
 */
export async function syncWakewordModelOnStartup(
  options: WakewordModelUpdateOptions,
): Promise<WakewordModelUpdateResult> {
  try {
    log('startup sync: begin for', options.fileName);
    const result = await checkForWakewordModelUpdate({
      ...options,
      timeoutMs: options.timeoutMs ?? WAKEWORD_UPDATE_STARTUP_TIMEOUT_MS,
    });
    log('startup sync: done', JSON.stringify(result));
    return result;
  } catch (error) {
    log('startup sync failed (ignored):', error);
    const modelPath = await getActiveWakewordModelPath(options.fileName);
    return {
      status: 'failed',
      fileName: options.fileName,
      modelPath,
      usingDownloadedModel: modelPath !== options.fileName,
      sha256: null,
      reason: String(error),
    };
  }
}

async function runUpdateCheck({
  fileName,
  timeoutMs = WAKEWORD_UPDATE_MANUAL_TIMEOUT_MS,
  onDownloadStart,
}: WakewordModelUpdateOptions): Promise<WakewordModelUpdateResult> {
  const deadline = Date.now() + timeoutMs;
  const remaining = () => deadline - Date.now();
  const stepTimeout = () => Math.max(MIN_STEP_TIMEOUT_MS, remaining());
  const modelUrl = getWakewordModelCdnUrl(fileName);
  log('runUpdateCheck: start', {
    fileName,
    modelUrl,
    sidecarUrl: `${modelUrl}${WAKEWORD_MODEL_HASH_SUFFIX}`,
    timeoutMs,
    modelsDir: getWakewordModelsDir(),
    platform: Platform.OS,
  });

  const manifest = await readManifest(fileName);
  log('runUpdateCheck: currently active =', manifest.active ? `downloaded ${manifest.active.relativePath} (sha256 ${manifest.active.sha256})` : 'bundled model');
  let bundledSha256: string | null | undefined; // undefined = not computed yet
  const getBundledSha256 = async () => {
    if (bundledSha256 === undefined) bundledSha256 = await hashBundledModel(fileName);
    return bundledSha256;
  };

  const finish = (status: WakewordModelUpdateStatus, reason?: string): WakewordModelUpdateResult => {
    log('runUpdateCheck: RESULT', status, reason ?? '', 'active =', manifest.active ? manifest.active.relativePath : '(bundled model)', `remaining ${remaining()}ms`);
    return {
      status,
      fileName,
      modelPath: manifest.active ? toAbsoluteModelPath(manifest.active.relativePath) : fileName,
      usingDownloadedModel: manifest.active != null,
      sha256: manifest.active?.sha256 ?? bundledSha256 ?? null,
      reason,
    };
  };

  // Drop the downloaded model and go back to the bundled one.
  const useBundledModel = async (remote: RemoteMetadata | null) => {
    log('runUpdateCheck: switching back to the BUNDLED model (dropping downloaded copy)');
    manifest.active = null;
    manifest.remote = remote ? { ...remote, checkedAt: nowIso() } : null;
    await writeManifestSafe(manifest);
    await removeOtherVersionDirs(null);
  };

  // Self-heal: an installed model whose file vanished means "bundled model" again.
  if (manifest.active && !(await RNFS.exists(toAbsoluteModelPath(manifest.active.relativePath)))) {
    log('installed model missing on disk; resetting to the bundled model');
    manifest.active = null;
    await writeManifestSafe(manifest);
  }

  // 1) Preferred check: the sidecar hash file next to the model on the CDN.
  const remoteSha256 = await fetchRemoteSha256(
    `${modelUrl}${WAKEWORD_MODEL_HASH_SUFFIX}`,
    stepTimeout(),
  );
  let remoteMetadata: RemoteMetadata | null = null;

  if (remoteSha256) {
    if (manifest.active?.sha256 === remoteSha256) {
      log('runUpdateCheck: remote sha256 matches the installed downloaded model');
      return finish('up_to_date');
    }
    const bundled = await getBundledSha256();
    log('runUpdateCheck: compare remote vs bundled', { remoteSha256, bundledSha256: bundled });
    if (bundled === remoteSha256) {
      // The CDN serves exactly what ships in the app (typical right after an app update).
      if (manifest.active) await useBundledModel(null);
      return finish('up_to_date');
    }
    log('runUpdateCheck: remote sha256 differs from installed and bundled -> download needed');
  } else {
    // 2) Fallback check: cheap HTTP metadata. It only says "something changed", so the
    //    downloaded bytes are still hashed and compared before anything is swapped.
    if (remaining() < MIN_STEP_TIMEOUT_MS) return finish('unavailable', 'out of time before HEAD');
    remoteMetadata = await fetchRemoteMetadata(modelUrl, stepTimeout());
    if (!remoteMetadata) return finish('unavailable', 'no sidecar hash and no HEAD metadata');
    if (manifest.remote && sameRemoteMetadata(manifest.remote, remoteMetadata)) {
      log('runUpdateCheck: HEAD metadata unchanged since', manifest.remote.checkedAt);
      return finish('up_to_date');
    }
    log('runUpdateCheck: HEAD metadata changed (or never recorded) -> download needed', { previous: manifest.remote, current: remoteMetadata });
  }

  // 3) Download to a temp file, verify, then install.
  if (remaining() < MIN_STEP_TIMEOUT_MS) return finish('unavailable', 'out of time before download');
  const tmpFile = `${getTmpDir()}/${fileName}.${Date.now()}.part`;
  try {
    onDownloadStart?.();
    await RNFS.mkdir(getTmpDir());
    const download = await downloadToFile(modelUrl, tmpFile, stepTimeout());
    if (!download.ok) {
      await safeUnlink(tmpFile);
      return finish('failed', download.reason);
    }

    const downloadedSha256 = await hashFile(tmpFile);
    if (!downloadedSha256) {
      await safeUnlink(tmpFile);
      return finish('failed', 'could not hash the download');
    }
    if (remoteSha256 && downloadedSha256 !== remoteSha256) {
      log('runUpdateCheck: downloaded sha256 does not match sidecar', { downloadedSha256, remoteSha256 });
      await safeUnlink(tmpFile);
      return finish('failed', 'sha256 mismatch (stale CDN copy?)');
    }
    log('runUpdateCheck: download verified', { downloadedSha256 });

    // Same bytes as the model already in use: remember the remote metadata, swap nothing.
    if (manifest.active?.sha256 === downloadedSha256) {
      log('runUpdateCheck: downloaded bytes equal the installed downloaded model; nothing to swap');
      await safeUnlink(tmpFile);
      if (remoteMetadata) manifest.remote = { ...remoteMetadata, checkedAt: nowIso() };
      await writeManifestSafe(manifest);
      return finish('up_to_date');
    }
    if ((await getBundledSha256()) === downloadedSha256) {
      log('runUpdateCheck: downloaded bytes equal the bundled model; nothing to swap');
      await safeUnlink(tmpFile);
      await useBundledModel(remoteMetadata);
      return finish('up_to_date');
    }

    // Install into its own version directory so the native .dm unpack cache cannot go stale.
    const versionDirName = versionDirNameFor(downloadedSha256);
    const versionDir = `${getWakewordModelsDir()}/${versionDirName}`;
    const finalPath = `${versionDir}/${fileName}`;
    log('runUpdateCheck: INSTALLING new model', tmpFile, '->', finalPath);
    await RNFS.mkdir(versionDir);
    await safeUnlink(finalPath);
    await RNFS.moveFile(tmpFile, finalPath);
    log('runUpdateCheck: model moved into place', finalPath);
    manifest.active = {
      sha256: downloadedSha256,
      relativePath: `${versionDirName}/${fileName}`,
      installedAt: nowIso(),
    };
    manifest.remote = remoteMetadata ? { ...remoteMetadata, checkedAt: nowIso() } : null;
    await writeManifest(manifest);
    await removeOtherVersionDirs(versionDirName);
    return finish('updated');
  } catch (error) {
    log('runUpdateCheck: unexpected error during download/install', error);
    await safeUnlink(tmpFile);
    return finish('failed', String(error));
  }
}
