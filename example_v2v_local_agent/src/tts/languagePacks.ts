import RNFS from 'react-native-fs';
import nacl from 'tweetnacl';
import type { AppLanguage } from '../appflow';

import { BUNDLED_LANGUAGES, LANGUAGE_FILES, LANGUAGE_PACK_BASE_URL, type LanguagePackFile, type LanguagePackFiles } from './languagePacks.generated';

// Language packs (2026-11-12): language_packs.json (example root) says which languages are built into the
// app ("bundled", default English + Brazilian Portuguese) and where the others are downloaded from
// ("baseUrl"/<file>); scripts/generate-language-packs.js turns it into languagePacks.generated.ts (Metro
// runs it on every bundle). A downloaded language's TTS model + voice-cloning embedder are fetched the
// first time the language is chosen (sha256 checked); src/tts/index.ts then uses the downloaded files.
//
// Remote voice manifest (2026-11-12, user Q3): installed apps get new voice files without an app update.
//  - refreshLanguagePackManifest() fetches <baseUrl>/manifest.json in the background. It is used only when its Ed25519 signature
//    verifies with MANIFEST_PUBLIC_KEY (the private key never ships), its schema is one this app reads, and every entry is valid
//    (file name, size, sha256). It can only change WHICH voice files a downloaded language uses: never code, never the LLM, never a
//    built-in language, and the files still come from the same baseUrl and are sha256-checked. Offline / missing / invalid: the
//    built-in config (languagePacks.generated.ts) as before.
//  - Updates are atomic: each version lives in its own folder (language_packs/<language>/<version>/); a new version is used only
//    once BOTH its files are downloaded and verified; until then the version in use keeps working.
//  - The last WORKING version is kept (markLanguagePackWorking after the speech library loaded it); a new version that fails to load
//    is rolled back (rollbackLanguagePack) and never used again.

type PackFile = LanguagePackFile;
export type LanguagePack = LanguagePackFiles;

/** Ed25519 public key of DaVoice's voice-manifest signer (base64, 32 bytes). */
const MANIFEST_PUBLIC_KEY = '7/WYUqZDy1sTXyE4CKepClQ8GAEz0rvpbSWSMAIBYDA=';
/** The manifest schema this app reads. */
const MANIFEST_SCHEMA = 1;
export const LANGUAGE_PACK_MANIFEST_URL = LANGUAGE_PACK_BASE_URL ? `${LANGUAGE_PACK_BASE_URL}/manifest.json` : '';

/** The built-in downloaded languages (in the config, not bundled). */
export const LANGUAGE_PACKS: Partial<Record<AppLanguage, LanguagePack>> = Object.fromEntries(
  Object.entries(LANGUAGE_FILES).filter(([id]) => !BUNDLED_LANGUAGES.includes(id as AppLanguage)),
);

// ---------- manifest ----------

export type VerifiedManifest = { version: string; languages: Partial<Record<AppLanguage, LanguagePack>> };

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.dm$/;

function base64ToBytes(b64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function utf8Bytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(bytes);
}

function packFile(x: any): PackFile | null {
  if (!x || typeof x !== 'object') return null;
  const { file, bytes, sha256 } = x;
  if (typeof file !== 'string' || !FILE_NAME.test(file)) return null;
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 2_000_000_000) return null;
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  return { filename: file, sizeBytes: bytes, sha256 };
}

/**
 * Parses and verifies a manifest file ({"payload": "<json>", "signature": "<base64 Ed25519 over the payload's UTF-8 bytes>"}).
 * Returns null when anything is off: the signature, the schema, a language this app doesn't download, or any invalid entry (the
 * whole manifest is then ignored, never applied in part). Exported for the tests (publicKey).
 */
export function verifyManifest(text: string, publicKey: string = MANIFEST_PUBLIC_KEY): VerifiedManifest | null {
  try {
    const outer = JSON.parse(text);
    if (typeof outer?.payload !== 'string' || typeof outer?.signature !== 'string') return null;
    const ok = nacl.sign.detached.verify(utf8Bytes(outer.payload), base64ToBytes(outer.signature), base64ToBytes(publicKey));
    if (!ok) return null;
    const p = JSON.parse(outer.payload);
    if (p?.schema !== MANIFEST_SCHEMA || typeof p.version !== 'string' || !p.version || typeof p.languages !== 'object' || !p.languages) return null;
    const languages: Partial<Record<AppLanguage, LanguagePack>> = {};
    for (const [id, entry] of Object.entries(p.languages as Record<string, any>)) {
      if (!LANGUAGE_PACKS[id as AppLanguage]) continue;   // built-in or unknown languages are never changed by a manifest
      const model = packFile(entry?.model);
      const embedder = packFile(entry?.embedder);
      if (!model || !embedder) return null;
      languages[id as AppLanguage] = { model, embedder };
    }
    return { version: p.version, languages };
  } catch {
    return null;
  }
}

// ---------- storage ----------

const root = () => `${RNFS.DocumentDirectoryPath}/language_packs`;
const versionKey = (pack: LanguagePack) => `${pack.model.sha256.slice(0, 12)}-${pack.embedder.sha256.slice(0, 12)}`;
const versionDir = (language: AppLanguage, pack: LanguagePack) => `${root()}/${language}/${versionKey(pack)}`;
const filePath = (language: AppLanguage, pack: LanguagePack, kind: 'model' | 'embedder') => `${versionDir(language, pack)}/${pack[kind].filename}`;

type WorkingState = Partial<Record<AppLanguage, LanguagePack>>;
type BadState = Partial<Record<AppLanguage, string[]>>;
let manifest: VerifiedManifest | null = null;
let manifestLoaded = false;
let working: WorkingState = {};
let bad: BadState = {};

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  if (!(await RNFS.exists(root()))) await RNFS.mkdir(root());
  const tmp = `${path}.tmp`;
  await RNFS.writeFile(tmp, JSON.stringify(value), 'utf8');
  await RNFS.unlink(path).catch(() => undefined);
  await RNFS.moveFile(tmp, path);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return (await RNFS.exists(path)) ? (JSON.parse(await RNFS.readFile(path, 'utf8')) as T) : null;
  } catch {
    return null;
  }
}

/** The stored manifest (verified again: a file on the device is not trusted either), working and bad versions. */
async function loadState(): Promise<void> {
  if (manifestLoaded) return;
  manifestLoaded = true;
  const stored = await RNFS.exists(`${root()}/manifest.json`).catch(() => false)
    ? await RNFS.readFile(`${root()}/manifest.json`, 'utf8').catch(() => '')
    : '';
  manifest = stored ? verifyManifest(stored) : null;
  working = (await readJson<WorkingState>(`${root()}/working.json`)) ?? {};
  bad = (await readJson<BadState>(`${root()}/bad.json`)) ?? {};
}

/** The version this app should use for `language`: the verified manifest's, unless it failed before, else the built-in one. */
function wantedPack(language: AppLanguage): LanguagePack | undefined {
  const fromManifest = manifest?.languages[language];
  if (fromManifest && !(bad[language] ?? []).includes(versionKey(fromManifest))) return fromManifest;
  return LANGUAGE_PACKS[language];
}

/**
 * Fetches, verifies and stores the remote manifest (call once at app start, in the background; never throws). Returns what
 * happened, for the log.
 */
export async function refreshLanguagePackManifest(timeoutMs = 8000): Promise<string> {
  try {
    await loadState();
    if (!LANGUAGE_PACK_MANIFEST_URL) return 'no manifest URL';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let text: string;
    try {
      const res = await fetch(LANGUAGE_PACK_MANIFEST_URL, { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
      if (res.status !== 200) return `no remote manifest (HTTP ${res.status}); ${manifest ? `stored ${manifest.version}` : 'built-in config'}`;
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }
    const verified = verifyManifest(text);
    if (!verified) return `remote manifest REJECTED (signature / schema / entries); ${manifest ? `stored ${manifest.version}` : 'built-in config'}`;
    if (manifest && manifest.version === verified.version) return `manifest ${verified.version} unchanged`;
    await writeJsonAtomic(`${root()}/manifest.json`, JSON.parse(text));
    manifest = verified;
    return `manifest ${verified.version} applied (${Object.keys(verified.languages).join(', ') || 'no languages'})`;
  } catch (error) {
    return `manifest not refreshed: ${String((error as Error)?.message ?? error)}`;
  }
}

// ---------- readiness ----------

/** Per language: the version in use this session (getTTSVoiceConfig / getVoiceEmbedder are synchronous). */
const active = new Map<AppLanguage, LanguagePack>();

async function complete(language: AppLanguage, pack: LanguagePack): Promise<boolean> {
  for (const kind of ['model', 'embedder'] as const) {
    const path = filePath(language, pack, kind);
    if (!(await RNFS.exists(path))) return false;
    if (Number((await RNFS.stat(path)).size) !== pack[kind].sizeBytes) return false;
  }
  return true;
}

/** Files of the first layout (language_packs/<language>/<file>, before versions): moved into their version folder once. */
async function migrateLegacy(language: AppLanguage, pack: LanguagePack): Promise<void> {
  const legacy = (kind: 'model' | 'embedder') => `${root()}/${language}/${pack[kind].filename}`;
  for (const kind of ['model', 'embedder'] as const) {
    const path = legacy(kind);
    if (!(await RNFS.exists(path)) || Number((await RNFS.stat(path)).size) !== pack[kind].sizeBytes) return;
  }
  await RNFS.mkdir(versionDir(language, pack));
  for (const kind of ['model', 'embedder'] as const) await RNFS.moveFile(legacy(kind), filePath(language, pack, kind));
}

/** True when `language` is not bundled and comes as a downloaded language pack. */
export function isDownloadableLanguage(language: AppLanguage): boolean {
  return LANGUAGE_PACKS[language] != null;
}

export function languagePackSizeBytes(language: AppLanguage): number {
  const pack = wantedPack(language);
  return pack ? pack.model.sizeBytes + pack.embedder.sizeBytes : 0;
}

/**
 * True when a usable version of `language` is on the device: the wanted one (manifest or built-in), else the last working one
 * (the app runs with it while the new version downloads in the background: updateLanguagePackInBackground). Built-in: true.
 */
export async function isLanguagePackReady(language: AppLanguage): Promise<boolean> {
  const wanted = wantedPack(language);
  if (!wanted) return true; // bundled
  await loadState();
  if (!(await complete(language, wanted))) await migrateLegacy(language, wanted).catch(() => undefined);
  if (await complete(language, wanted)) {
    active.set(language, wanted);
    return true;
  }
  const last = working[language];
  if (last && (await complete(language, last))) {
    active.set(language, last);
    return true;
  }
  active.delete(language);
  return false;
}

/** True when a newer wanted version exists than the one in use (download it in the background for the next start). */
export function languagePackUpdatePending(language: AppLanguage): boolean {
  const wanted = wantedPack(language);
  const using = active.get(language);
  return !!wanted && !!using && versionKey(wanted) !== versionKey(using);
}

/** The downloaded file's absolute path (the speech library takes plain paths), or null if the pack isn't ready. */
export function languagePackFilePath(language: AppLanguage, kind: 'model' | 'embedder'): string | null {
  const pack = active.get(language);
  return pack ? filePath(language, pack, kind) : null;
}

/**
 * The speech library loaded `language`'s files: this version is the last working one (kept until a newer one works). Older
 * versions of the language are removed (one previous version is enough to roll back to).
 */
export async function markLanguagePackWorking(language: AppLanguage): Promise<void> {
  const pack = active.get(language);
  if (!pack) return;
  const previous = working[language];
  working = { ...working, [language]: pack };
  await writeJsonAtomic(`${root()}/working.json`, working).catch(() => undefined);
  const keep = new Set([versionKey(pack), ...(previous ? [versionKey(previous)] : [])]);
  const wanted = wantedPack(language);
  if (wanted) keep.add(versionKey(wanted));
  try {
    for (const entry of await RNFS.readDir(`${root()}/${language}`)) {
      // other versions, and loose files of the first (unversioned) layout
      if (!entry.isDirectory() || !keep.has(entry.name)) await RNFS.unlink(entry.path).catch(() => undefined);
    }
  } catch {
    // only a cleanup
  }
}

/**
 * The speech library could NOT load `language`'s files: that version is never used again and the last working version is selected
 * (true), or there is none (false: the app reports the error as before).
 */
export async function rollbackLanguagePack(language: AppLanguage): Promise<boolean> {
  const failed = active.get(language);
  const last = working[language];
  if (!failed || !last || versionKey(last) === versionKey(failed) || !(await complete(language, last))) return false;
  bad = { ...bad, [language]: [...(bad[language] ?? []), versionKey(failed)] };
  await writeJsonAtomic(`${root()}/bad.json`, bad).catch(() => undefined);
  active.set(language, last);
  return true;
}

// ---------- download ----------

export type LanguagePackProgress = {
  stage: 'download' | 'verify';
  bytesDone: number;
  bytesTotal: number;
};

type InFlight = { promise: Promise<void>; cancel: () => void };
const inFlight = new Map<AppLanguage, InFlight>();
const listeners = new Map<AppLanguage, Set<(p: LanguagePackProgress) => void>>();

/** Stops a running download (the partial file is removed; the next download starts over). */
export function cancelLanguagePackDownload(language: AppLanguage): void {
  inFlight.get(language)?.cancel();
}

/**
 * Downloads the wanted version of `language` into its own folder if it isn't complete yet; concurrent callers join the same
 * download. The version in use is not touched. Rejects with a readable message (no URL yet, no space, HTTP error, checksum
 * mismatch, cancelled).
 */
export function downloadLanguagePack(
  language: AppLanguage,
  onProgress?: (progress: LanguagePackProgress) => void,
): Promise<void> {
  if (onProgress) {
    if (!listeners.has(language)) listeners.set(language, new Set());
    listeners.get(language)!.add(onProgress);
  }
  const existing = inFlight.get(language);
  if (existing) return existing.promise;

  let cancelled = false;
  let jobId: number | null = null;
  const emit = (p: LanguagePackProgress) => listeners.get(language)?.forEach((listener) => listener(p));
  const run = async () => {
    await loadState();
    const pack = wantedPack(language);
    if (!pack) return;
    if (!(await complete(language, pack))) await migrateLegacy(language, pack).catch(() => undefined);
    if (await complete(language, pack)) {
      await isLanguagePackReady(language);
      return;
    }
    if (!LANGUAGE_PACK_BASE_URL) {
      throw new Error('This language pack is not available yet (its download address is not set in the app).');
    }
    const kinds = ['model', 'embedder'] as const;
    const bytesTotal = pack.model.sizeBytes + pack.embedder.sizeBytes;
    const dir = versionDir(language, pack);
    if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);

    // Room for the files plus a margin (the files already on disk count as done).
    let missingBytes = 0;
    for (const kind of kinds) {
      const path = filePath(language, pack, kind);
      const ok = (await RNFS.exists(path)) && Number((await RNFS.stat(path)).size) === pack[kind].sizeBytes;
      if (!ok) missingBytes += pack[kind].sizeBytes;
    }
    const { freeSpace } = await RNFS.getFSInfo();
    if (freeSpace < missingBytes + 100 * 1024 * 1024) {
      throw new Error(
        `Not enough free space: ${Math.ceil(missingBytes / 1e6)} MB needed, ${Math.floor(freeSpace / 1e6)} MB free.`,
      );
    }

    let bytesBefore = 0;
    for (const kind of kinds) {
      const file = pack[kind];
      const dest = filePath(language, pack, kind);
      if ((await RNFS.exists(dest)) && Number((await RNFS.stat(dest)).size) === file.sizeBytes) {
        bytesBefore += file.sizeBytes;
        emit({ stage: 'download', bytesDone: bytesBefore, bytesTotal });
        continue;
      }
      if (cancelled) throw new Error('Download cancelled.');
      const tmp = `${dest}.download`;
      await RNFS.unlink(tmp).catch(() => undefined);
      const job = RNFS.downloadFile({
        fromUrl: `${LANGUAGE_PACK_BASE_URL}/${file.filename}`,
        toFile: tmp,
        begin: () => {}, // iOS reports progress only with a begin handler (see ModelManager.ts)
        progress: (res) => emit({ stage: 'download', bytesDone: bytesBefore + res.bytesWritten, bytesTotal }),
        progressInterval: 100,
      });
      jobId = job.jobId;
      let result;
      try {
        result = await job.promise;
      } catch (e) {
        await RNFS.unlink(tmp).catch(() => undefined);
        throw cancelled ? new Error('Download cancelled.') : e;
      } finally {
        jobId = null;
      }
      if (cancelled) {
        await RNFS.unlink(tmp).catch(() => undefined);
        throw new Error('Download cancelled.');
      }
      if (result.statusCode !== 200) {
        await RNFS.unlink(tmp).catch(() => undefined);
        throw new Error(`Download failed: HTTP ${result.statusCode} for ${file.filename}.`);
      }
      bytesBefore += file.sizeBytes;
      emit({ stage: 'verify', bytesDone: bytesBefore, bytesTotal });
      const hash = (await RNFS.hash(tmp, 'sha256')).toLowerCase();
      if (hash !== file.sha256) {
        await RNFS.unlink(tmp).catch(() => undefined);
        throw new Error(`Download failed: ${file.filename} is damaged (checksum mismatch). Please retry.`);
      }
      await RNFS.unlink(dest).catch(() => undefined);
      await RNFS.moveFile(tmp, dest);
    }
    if (!(await isLanguagePackReady(language))) {
      throw new Error('Download failed: the language pack is incomplete. Please retry.');
    }
  };

  const promise = run().finally(() => {
    inFlight.delete(language);
    listeners.delete(language);
  });
  inFlight.set(language, {
    promise,
    cancel: () => {
      cancelled = true;
      if (jobId != null) RNFS.stopDownload(jobId);
    },
  });
  return promise;
}

/** A newer version (remote manifest) while an older one is in use: downloaded quietly for the next start; never throws. */
export function updateLanguagePackInBackground(language: AppLanguage): void {
  if (!languagePackUpdatePending(language)) return;
  downloadLanguagePack(language).catch((error) =>
    console.log(`[languagePacks] background update of ${language} failed (the current version stays):`, error));
}

/** Removes every downloaded version of a language pack (downloaded again the next time the language is chosen). */
export async function deleteLanguagePack(language: AppLanguage): Promise<void> {
  active.delete(language);
  const dir = `${root()}/${language}`;
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
}
