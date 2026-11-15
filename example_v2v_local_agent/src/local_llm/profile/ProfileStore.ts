import RNFS from 'react-native-fs';
import { LOCAL_LLM_STORAGE_DIR } from '../constants';

// RNFS-JSON-backed, per speakerId, the same pattern already used for
// sv_enrollment.json in src/speaker_verification/onboarding.ts (there is no
// AsyncStorage dependency in this app — don't introduce one here).

export interface UserProfile {
  speakerId: string;
  displayName?: string;
  preferredTone?: string;
  language?: string;
}

function profilePath(speakerId: string): string {
  const safeId = speakerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${RNFS.DocumentDirectoryPath}/${LOCAL_LLM_STORAGE_DIR}/profiles/${safeId}.json`;
}

export async function getProfile(speakerId: string): Promise<UserProfile | null> {
  const path = profilePath(speakerId);
  if (!(await RNFS.exists(path))) return null;
  const raw = await RNFS.readFile(path, 'utf8');
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const path = profilePath(profile.speakerId);
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
  await RNFS.writeFile(path, JSON.stringify(profile), 'utf8');
}
