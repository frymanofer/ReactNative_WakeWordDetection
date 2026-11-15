// The remote voice manifest (src/tts/languagePacks.ts verifyManifest, 2026-11-12): applied only when signed by the right key, of a
// schema this app reads, and every entry valid; never for built-in or unknown languages.
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/docs' }));
import nacl from 'tweetnacl';
import { verifyManifest } from '../src/tts/languagePacks';

const keys = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
const pub = Buffer.from(keys.publicKey).toString('base64');
const entry = (file: string) => ({ file, bytes: 1000, sha256: 'a'.repeat(64) });
function signed(payload: object, secretKey = keys.secretKey) {
  const text = JSON.stringify(payload);
  const signature = Buffer.from(nacl.sign.detached(Buffer.from(text, 'utf8'), secretKey)).toString('base64');
  return JSON.stringify({ payload: text, signature });
}
const fr = { model: entry('model_ex2_french_v2.dm'), embedder: entry('embedder_fr_v2.dm') };

test('a valid signed manifest is applied to downloaded languages only', () => {
  const m = verifyManifest(signed({ schema: 1, version: '2026-11-12.1', languages: { fr, en: fr, xx: fr } }), pub);
  expect(m?.version).toBe('2026-11-12.1');
  expect(Object.keys(m!.languages).sort()).toEqual(['en', 'fr']);   // every language is downloaded in this example; xx unknown: never changed
  expect(m!.languages.fr!.model.filename).toBe('model_ex2_french_v2.dm');
});

test('the wrong key, a changed payload or a missing signature is rejected', () => {
  const other = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(9));
  expect(verifyManifest(signed({ schema: 1, version: 'v', languages: { fr } }, other.secretKey), pub)).toBeNull();
  const good = JSON.parse(signed({ schema: 1, version: 'v', languages: { fr } }));
  good.payload = good.payload.replace('1000', '2000');
  expect(verifyManifest(JSON.stringify(good), pub)).toBeNull();
  expect(verifyManifest(JSON.stringify({ payload: '{}' }), pub)).toBeNull();
  expect(verifyManifest('not json', pub)).toBeNull();
});

test('an unknown schema or any invalid entry rejects the whole manifest', () => {
  expect(verifyManifest(signed({ schema: 2, version: 'v', languages: { fr } }), pub)).toBeNull();
  const bad = (x: object) => verifyManifest(signed({ schema: 1, version: 'v', languages: { fr: { ...fr, ...x } } }), pub);
  expect(bad({ model: entry('../../evil.dm') })).toBeNull();
  expect(bad({ model: entry('code.js') })).toBeNull();
  expect(bad({ embedder: { file: 'e.dm', bytes: -1, sha256: 'a'.repeat(64) } })).toBeNull();
  expect(bad({ embedder: { file: 'e.dm', bytes: 10, sha256: 'xyz' } })).toBeNull();
});

test('the app ships the real public key: a manifest signed with a test key is rejected', () => {
  expect(verifyManifest(signed({ schema: 1, version: 'v', languages: { fr } }))).toBeNull();
});
