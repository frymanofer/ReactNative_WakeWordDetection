import { Platform } from 'react-native';

/**
 * DaVoice license for this example (wake word + speaker verification).
 * This demo license expires on 2026-12-01. For your own app, or a newer demo license, contact info@davoice.io.
 */
export const DAVOICE_LICENSE = 'MTc5NjA3NjAwMDAwMA==-FmI0i6C8wjKqQwmvi/PAmUy9ayviOGvWhGLFGHZrg9I=';

/** The wake word model bundled with the app (android/app/src/main/assets and the iOS app bundle). */
export const WAKEWORD_MODEL = 'hey_coach_model_28_22012026b.dm';
/** The phrase the bundled model listens for. */
export const WAKEWORD_PHRASE = 'Hey Coach';
/** Detection threshold (0..1): higher = fewer false wake-ups. */
export const WAKEWORD_THRESHOLD = 0.999;
/** Consecutive positive frames needed for one detection. */
export const WAKEWORD_BUFFER_COUNT = 3;
/** Minimum time between two detections. */
export const WAKEWORD_MS_BETWEEN_CALLBACKS = 1000;

/** The speaker verification model bundled with the app. */
export const SV_MODEL = 'sv.dm';
/** Speaker verification decision threshold (score of the enrolled voice). */
export const SV_DECISION_THRESHOLD = Platform.OS === 'android' ? 0.34 : 0.35;
/** How many voice samples the enrollment collects. */
export const SV_ENROLLMENT_SAMPLES = 5;
/** Where the enrolled voice profile is saved (inside the app's documents folder). */
export const SV_PROFILE_FILE = 'sv_enrollment.json';
