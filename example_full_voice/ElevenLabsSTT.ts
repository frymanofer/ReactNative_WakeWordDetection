// ---- CONFIG ----
import Config from 'react-native-config';

// (Keep your key safe; consider injecting at build time instead of hardcoding.)
const ELEVEN_API_KEY = Config.ELEVEN_LABS_KEY;

// ElevenLabsTTS.ts (React Native only, no Expo)
import { Buffer } from 'buffer';
(global as any).Buffer = (global as any).Buffer || Buffer;

const MODEL_ID = 'eleven_multilingual_v2';     // pick your preferred model
// ---------------
const ELEVEN_API = 'https://api.elevenlabs.io/v1/speech-to-text';


type STTResult = {
  text?: string;
  words?: Array<{ start: number; end: number; text: string; speaker?: string }>;
  diarize?: boolean;
  language_code?: string;
  // ...the API returns more fields; keep what you need
};

export async function transcribeWithElevenLabs(
  fileUri: string,
  options?: {
    model_id?: 'scribe_v1';
    language_code?: string | null; // e.g. 'eng' or null to auto-detect
    diarize?: boolean;
    tag_audio_events?: boolean;
    use_multi_channel?: boolean;
  }
): Promise<STTResult> {
  const {
    model_id = 'scribe_v1',
    language_code = null,     // null = auto language detection
    diarize = false,
    tag_audio_events = false,
    use_multi_channel = false,
  } = options || {};

  // React Native FormData upload of a local file (wav/mp3/m4a…)
  const form = new FormData();
  form.append('file', {
    // IMPORTANT: RN needs uri + name + type
    uri: fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`,
    name: 'audio.wav',               // any name is fine
    type: 'audio/wav',               // set to your real mime if mp3/m4a
  } as any);
  form.append('model_id', model_id);
  if (language_code !== undefined && language_code !== null) {
    form.append('language_code', language_code);
  }
  form.append('diarize', String(diarize));
  form.append('tag_audio_events', String(tag_audio_events));
  form.append('use_multi_channel', String(use_multi_channel));

  const res = await fetch(ELEVEN_API, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
      // DO NOT set Content-Type manually; let fetch set the multipart boundary.
      Accept: 'application/json',
    },
    body: form,
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`STT failed ${res.status}: ${errTxt}`);
  }

  const json = (await res.json()) as STTResult;
  return json;
}
