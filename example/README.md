# DaVoice Wake Word + Speaker Verification — React Native example

An on-device wake word app with speaker verification, built with
[`react-native-wakeword`](https://www.npmjs.com/package/react-native-wakeword) 1.1.171 and React Native 0.82.

- Always-listening wake word ("Hey Coach"), fully on device.
- **Speaker verification (SV):** enroll your voice once, and the wake word then answers **only to you**. Other
  people saying the wake word, a TV or a podcast are ignored. This is checked natively, as part of the detection.
- Test your enrolled voice: a live score while you talk.

## Run it

```bash
npm install          # also checks that the bundled models are real files (Git LFS)
npx react-native run-android
# iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

Model files (`*.dm`) are stored with [Git LFS](https://git-lfs.com). If you cloned without LFS, run
`git lfs install && git lfs pull`.

## How to use the app

1. Grant microphone access.
2. Say **"Hey Coach"**. Every detection is listed.
3. Tap **Enroll my voice** and read the lines on the screen out loud: the wake word several times and a few other
   sentences, until all 5 samples are captured.
4. With **Only my voice wakes the app** on, only your voice triggers the wake word.
5. **Test my voice** scores your voice continuously while you talk (Last score, Match, Since last). Ask someone else
   to talk too: their voice should show NO. Tap **Done** to go back.

## The code

| File | What it does |
| --- | --- |
| [`src/wakeword.ts`](src/wakeword.ts) | Creates the detector, applies the license, starts and stops listening, with or without a voice profile |
| [`src/speakerVerification.ts`](src/speakerVerification.ts) | Enrollment, saving the voice profile, testing a voice |
| [`src/config.ts`](src/config.ts) | Model names, thresholds, the license |
| [`App.tsx`](App.tsx) | The screen |

Wake word detection gated by speaker verification:

```ts
import { createKeyWordRNBridgeInstance } from 'react-native-wakeword';

const detector = await createKeyWordRNBridgeInstance('wakeword', false);
await detector.createInstanceMulti(['hey_coach_model_28_22012026b.dm'], [0.999], [3], [1000]);
detector.onKeywordDetectionEvent((event) => console.log('wake word!', event));
await detector.setKeywordDetectionLicense(LICENSE);

await detector.startKeywordDetection(0.999, true);                  // anyone
await detector.startKeywordDetection(0.999, voiceProfilePath, true); // only the enrolled speaker
```

Several speakers can be enrolled: `startKeywordDetectionWithSpeakers(threshold, [{ id, json }, ...])`,
`addSpeaker`, `removeSpeaker`.

## License

The license in `src/config.ts` is a demo license that expires on **2026-12-01**. For a license for your own app,
contact **info@davoice.io**. See also [MODEL_NOTICES.md](../MODEL_NOTICES.md).

Need your own wake word? See [WakeWordGenerator.md](../WakeWordGenerator.md) or https://davoice.io.
