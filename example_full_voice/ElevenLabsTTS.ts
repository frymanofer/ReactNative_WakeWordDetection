// ElevenLabsTTS.ts
import { Buffer } from 'buffer';
(global as any).Buffer = (global as any).Buffer || Buffer;

import Config from 'react-native-config';

// ✅ our unified speech helper (the one you just updated)
import Speech from 'react-native-davoice-tts/speech';

// ✅ RNFS fork APIs
import {
  CachesDirectoryPath,
  TemporaryDirectoryPath,
  DocumentDirectoryPath,
  exists,
  mkdir,
  writeFile,
  unlink,
} from '@dr.pogodin/react-native-fs';

// ---- CONFIG ----
// (Keep your key safe; consider injecting at build time instead of hardcoding.)
const ELEVEN_API_KEY = Config.ELEVEN_LABS_KEY;
const ARIANA_VOICE_ID = Config.ARIANA_VOICE_ID;
const RICH_VOICE_ID   = Config.RICH_VOICE_ID;
const MODEL_ID        = 'eleven_multilingual_v2';
const SPEAKER_RICH    = 0;
const SPEAKER_ARIANA  = 1;

// ---- RING OF FILES ----
const RING_SIZE = 100;
let ringIndex = 0;
function nextRingSlot(): number {
  const s = ringIndex;
  ringIndex = (ringIndex + 1) % RING_SIZE;
  return s;
}

// Pick a safe app sandbox directory
const DIR =
  CachesDirectoryPath ??
  TemporaryDirectoryPath ??
  DocumentDirectoryPath;

async function ensureDir(dir: string) {
  if (!dir) throw new Error('No writable directory from RNFS');
  const ok = await exists(dir);
  if (!ok) await mkdir(dir);
}

// --- ElevenLabs: fetch PCM/WAV bytes then write with RNFS ---
async function synthToWavFile(text: string, speakerId: number): Promise<string> {
  const voiceId = speakerId === SPEAKER_RICH ? RICH_VOICE_ID : ARIANA_VOICE_ID;

  await ensureDir(DIR);

  // 🔁 ring filename: tts_0.wav .. tts_99.wav
  const slot = nextRingSlot();
  const toFile = `${DIR}/tts_${slot}.wav`;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/wav',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.3, similarity_boost: 0.27, style: 0.57, speed: (speakerId === SPEAKER_RICH ? 0.98 : 0.9) },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS failed ${res.status}: ${msg}`);
  }

  const ab  = await res.arrayBuffer();
  const b64 = Buffer.from(ab).toString('base64');
  await writeFile(toFile, b64, 'base64');
  return toFile;
}

export async function speakWithCoach(cb: () => void, text: string, speakerId: number): Promise<void> {
  // 1) synth to local WAV
  const path = await synthToWavFile(text, speakerId);

  try {
    await Speech.playWav(path, true);

  } finally {
  }
}
