# Example App Source Guide

This folder breaks the original `App.tsx` logic into reusable feature modules so developers can copy the parts they need into their own app.

## Folder map

### `appflow.ts`
- Shared app-level constants and UI-oriented helpers.
- Includes:
  - `SV_ONBOARDING_SAMPLE_COUNT`
  - `SV_DECISION_THRESHOLD`
  - `getSVUIMatch(...)`
  - `getSVUIDisplayScore(...)`

### `initialization/`
- App startup helpers and speech initialization helpers.
- Main entry points:
  - `ensureMicPermission(...)`
  - `initializeSpeechLibrary(...)`
  - `promptForTTSModelChoice(...)`
  - `waitForIdle(...)`
  - `withTimeout(...)`

### `stt/`
- STT text-merging logic and speech callback wiring.
- Main entry points:
  - `registerSpeechHandlers(...)`
  - `mergeSmartKeepPunct(...)`
  - `getAdjustedSpeed(...)`

### `tts/`
- TTS constants, model assets, and reusable intro speech flow.
- Main entry points:
  - `playWakewordIntroSpeech(...)`
- Includes:
  - `ttsModelFast`
  - `ttsModelSlow`
  - `ttsModelRichFast`
  - `ttsModelRichSlow`
  - `SPEAKER`

### `wakeword/`
- Wakeword config, instance creation, listener wiring, wakeword bootstrap, recording capture, and related helpers.
- Main entry points:
  - `initializeWakewordBootstrap(...)`
  - `attachKeywordListenerOnce(...)`
  - `detachKeywordListener(...)`
  - `startWakewordDetection(...)`
  - `resumeWakewordDetection(...)`
  - `captureWakewordDetection(...)`
  - `prepareWakewordSpeechSession(...)`
  - `shareWakewordRecordings(...)`

### `speaker_verification/onboarding.ts`
- Enrollment persistence and onboarding flow.
- Main entry points:
  - `loadEnrollmentJsonFromFile(...)`
  - `writeEnrollmentJsonToFile(...)`
  - `runSpeakerVerifyEnrollment(...)`
  - `runSpeakerVerificationStartupFlow(...)`

### `speaker_verification/verification.ts`
- Verification runtime helpers.
- Main entry points:
  - `startEndlessVerificationWithEnrollmentFix(...)`
  - `verifyFromMicWithEnrollment(...)`
  - `runVerificationWithEnrollment(...)`

### `aichat/`
- Gemini request helpers and AI chat speech queue/session helpers.
- Main entry points:
  - `generateGeminiReply(...)`
  - `generateGeminiReplyStream(...)`
  - `finishAIChatSpeechFlow(...)`
  - `speakNextAIChatSentence(...)`
  - `enqueueAIChatSpeechFromDelta(...)`
  - `resetAIChatSession(...)`

## What stays in `App.tsx`

`App.tsx` is now mainly responsible for:
- React state and refs
- top-level feature orchestration
- screen transitions and prompts
- JSX and styles

## Recommended reuse paths

If you only want wakeword:
- start with `wakeword/`

If you want speaker verification onboarding + verification:
- start with `speaker_verification/`
- also use `appflow.ts` for SV thresholds/UI helpers

If you want STT + TTS speech loop:
- start with `stt/`, `tts/`, and `initialization/`

If you want the Gemini voice chat demo:
- start with `aichat/`, `stt/`, `tts/`, and `initialization/`
