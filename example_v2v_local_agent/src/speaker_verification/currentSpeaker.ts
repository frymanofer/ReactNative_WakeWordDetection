// Who spoke the user's current request, for actions only the car's owner may do (unlock_car, open_door: tool
// authorization scope "door_locks", see src/agent/LocalAgent.ts).
//
// react-native-davoice reports the verified speakers of a sentence in its STT results (speakerIds / speakerId) when
// speaker verification is on. The app records them per request and clears them after each turn.
//
// Policy: with speaker verification on, the enrolled owner's voice must be in the request. With it skipped, there is
// no way to tell voices apart: the demo allows it (logged), so the doors work without enrollment.

let gateOn = false;
let ownerId: string | null = null;
let heard = new Set<string>();

/** Called when speaker verification is applied (App.tsx applySpeakerVerificationChoice). */
export function setSpeakerGate(enabled: boolean, enrolledOwnerId: string | null): void {
  gateOn = enabled && !!enrolledOwnerId;
  ownerId = enrolledOwnerId;
  heard = new Set();
  console.log(`[SVGate] ${gateOn ? `on: owner "${ownerId}"` : 'off: speaker verification skipped'}`);
}

/** Every STT partial and final result (src/stt/index.ts). */
export function noteSpeechResult(event: { speakerIds?: string[]; speakerId?: string } | null | undefined): void {
  for (const id of event?.speakerIds ?? []) heard.add(id);
  if (event?.speakerId) heard.add(event.speakerId);
}

/** After a turn (src/aichat/provider.ts): the next request starts with nobody heard. */
export function clearHeardSpeakers(): void {
  heard = new Set();
}

/** May the current request do an owner-only action? */
export function ownerMayAct(): { allowed: boolean; reason: string } {
  if (!gateOn) return { allowed: true, reason: 'speaker verification is off (demo allows it)' };
  if (ownerId && heard.has(ownerId)) return { allowed: true, reason: `owner "${ownerId}" verified` };
  return { allowed: false, reason: heard.size ? `heard ${[...heard].join(', ')}, not the owner` : 'no verified speaker in this request' };
}
