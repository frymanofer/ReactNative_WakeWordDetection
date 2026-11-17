# Example App: React Native On-Device Voice-to-Voice AI Agent

This example app demonstrates a full **React Native voice AI** flow running on device:

- <a href="https://davoice.io/wake-word" target="_blank" rel="noopener noreferrer">wake word detection</a>
- <a href="https://davoice.io/speaker-recognition" target="_blank" rel="noopener noreferrer">speaker identification / speaker verification</a>
- real-time speech to text
- on-device text to speech
- coordinated pause/resume between wake word and ASR

The key implementation is in [App.tsx](./App.tsx). Step-by-step guides: [englishHowTo.md](./englishHowTo.md) (English) and [portugueseHowTo.md](./portugueseHowTo.md) (Português).

## What the demo shows

The demo is not just a wake-word sample. It is a full on-device voice pipeline designed to reflect how production voice apps actually behave.

The example includes:

- optional speaker onboarding
- using a saved speaker signature
- <a href="https://davoice.io/wake-word" target="_blank" rel="noopener noreferrer">wake-word detection</a> with recorded wake-word audio
- clean transition from <a href="https://davoice.io/wake-word" target="_blank" rel="noopener noreferrer">wake word</a> into speech recognition
- an intentional pause before STT to improve flow
- selectable TTS voices and model quality
- manual TTS test mode
- resuming the listening experience after speech

## Demo flow

1. Launch the app and grant microphone permissions.
2. Choose whether to create or reuse a speaker signature.
3. Start <a href="https://davoice.io/integration-guides-wake-word/react-native" target="_blank" rel="noopener noreferrer">wake word detection</a>.
4. Say the wake phrase.
5. The app pauses wake-word detection before moving into ASR.
6. If speaker verification is enabled, the app can enforce the onboarded speaker.
7. The app listens for speech and can speak back with on-device TTS.
8. The voice session is reset and the wake-word listener can resume.

## Why the pause matters

The pause between wake word detection and speech recognition is deliberate. In multi-stage mobile voice experiences, one of the biggest sources of instability is overlapping audio pipelines. This example demonstrates a cleaner handoff between:

- always-listening wake word
- speaker verification
- active speech recognition
- TTS playback

That is one of the main reasons this repository is useful as a React Native voice reference.

## Run the example

```bash
cd example
yarn
```

Android:

```bash
npx react-native run-android
```

iOS:

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## Models are downloaded, not bundled

This example ships only the small wake word and speaker verification models. Everything else is downloaded
on first use and kept on the device:

- **Voices (TTS), all languages:** the language screen downloads the selected language's voice. The list of
  languages, their files and the download URL are in [`language_packs.json`](language_packs.json). Add a language
  id to `"bundled"` (with its files in `assets/models/`) to ship it inside the app instead.
- **On-device AI models (Local AI Chat, Car demo):** every model in the model picker is downloaded when you pick
  it ([`src/local_llm/constants.ts`](src/local_llm/constants.ts)).

The first start of each language and each AI model needs an internet connection.

## Important setup notes

### Gemini API key

Do not commit a real `GEMINI_API_KEY` into this public repository.

For this demo app, the simplest approach is:

1. Keep the key in a local file that is ignored by git.
2. Load it into `App.tsx` from that local file.
3. Commit only a template/example file or a short setup note, not the real key.

Why this is better than asking developers to run `export GEMINI_API_KEY=...`:

- React Native apps do not automatically get shell environment variables at runtime on-device.
- A local ignored config file is easier for other developers to understand and reproduce.
- It avoids accidentally committing a shared API key into source control.

Recommended setup for contributors:

- `npm install` creates `local.config.ts` from `local.config.example.ts` (only when it is missing)
- `local.config.ts` is git-ignored
- Paste your real key into `export const GEMINI_API_KEY = 'your-key';`
- `App.tsx` imports the key from that local file

For production apps, a permanent Gemini key should usually not be shipped directly in the client at all. A backend proxy or short-lived token flow is safer.

### Local AI Chat web search

Local AI Chat runs on the device, so its model only knows facts up to its training. For
time-sensitive questions ("Who is the president of the US?", "latest", "today", news,
prices), the app says a short phrase such as "Well, that is a good question, let me search."
(picked to fit the question), searches the web, and the
on-device model answers from the results. Other questions never leave the device.

The search engine is replaceable. Choose it in the git-ignored `local.config.ts`:

```ts
export const WEB_SEARCH_ENGINE = 'wikipedia'; // default: free, no key. Or 'tavily' / 'brave'.
export const TAVILY_API_KEY = '';             // https://tavily.com (free plan available)
export const BRAVE_API_KEY = '';              // https://brave.com/search/api
```

All three lines are optional. Wikipedia handles "who currently holds this office" questions
well but has no news, prices or weather; Tavily and Brave are full web search. If the chosen
engine fails or finds nothing, Wikipedia is tried.

To use any other search API, set `engine: 'host'` in `webSearch` (see
`src/agent/LocalAgent.ts`) and answer the agent's `webSearch` requests in `Agent.create`'s
`onRequest`:

```ts
import { Agent } from 'react-native-davoice-llm';

const agent = await Agent.create(
  { pack, webSearch: { engine: 'host' } },
  {
    onRequest: async (request) => {
      if (request.type !== 'webSearch') throw new Error(`unexpected ${request.type}`);
      const res = await fetch(`https://my-api.example.com/search?q=${encodeURIComponent(String(request.query))}`);
      const json = await res.json();
      return {
        name: 'MySearch',
        passages: json.items.slice(0, Number(request.maxResults)).map((item: any) => ({
          text: item.snippet, // short plain text, most relevant first
          url: item.link,
          title: item.title,
        })),
      };
    },
  },
);
```

Which questions trigger a search is set in `agent/agent.json` (`webSearch.rules`).

### Local AI Chat: customize it with the agent pack

What the on-device AI says and does is configured in JSON files in `agent/` (the React
Native and Flutter examples ship the same files). react-native-davoice-llm's `Agent` (the same
native code on Android and iOS, and in the Flutter plugin) reads them; `src/agent/LocalAgent.ts`
creates it:

| File | What it holds |
|---|---|
| `agent.json` | Persona (system prompt), prompt wording, when to search the web, which Wikipedia page answers "who holds this office", and the phrases said while waiting |
| `skills/calories/skill.json` | The calorie tracker's tools (names, descriptions, arguments), which tool each kind of sentence uses, word lists and every message it says |
| `skills/calories/foods.json` | The food list: calories per typical serving |

Patterns are regular expressions, matched case-insensitively. Change a file and rebuild
the app; no code changes are needed. To add a food, add it to `foods.json`. At runtime the
app can also add, change or remove foods (`agent.skill('calories', 'foods.upsert', { food })`
/ `'foods.remove'`); those changes, and foods found online, are kept on the device (in the
agent's SQLite database) on top of the shipped list.

### Local AI Chat: the AI changes the app (tool calling and MCP)

Local AI Chat shows a **Calories today** card that the on-device AI updates by voice, using
react-native-davoice-llm's tool calling. Try:

- "I had two eggs for breakfast", "And a banana", "Log a can of coke"
- "Remove the banana" (deletes that line), "Remove 100 calories", "Set it to 1500", "Undo that"
- "How much have I eaten today?" / "What did I eat today?"
- "How many calories are in an apple?" (a question: answered without touching the tracker)

Every change shows on the card with an **Undo** button. The model extracts the food and
quantity and the app looks up the calories, so "two eggs" is always 156. Foods missing from
the built-in list are looked up on Wikipedia (per 100 g; "I had 200 grams of lentils" uses
the weight). For dishes and brands with real serving sizes, add a free
[USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup) key; USDA is then tried
first. If no source knows the food, the AI asks how many calories it had. Another source
can be added as `{ type: 'host', name }` in the calories skill's `sources`; the app answers
its `foodLookup` requests in `onRequest`.

The tracker's tools run in the agent (their definitions, routing and messages are in
`skills/calories/skill.json`), and the calorie log is kept in its SQLite database.
`src/calories/CaloriesCard.tsx` shows it (`agent.skill('calories', 'log.get')` and the
agent's `skill` events). Your app's own tools, or a remote MCP server's, join with
`agent.setTools(tools)`.

Optional settings, in the git-ignored local.config.ts:

```ts
export const MCP_SERVER_URL = 'https://example.com/mcp';  // optional: tools from a remote MCP server
export const MCP_SERVER_TOKEN = '';   // its bearer token, if it needs one
export const USDA_API_KEY = '';       // optional: USDA food lookup
```

### Metro assets

Make sure your Metro configuration supports DaVoice model assets such as `.onnx` and `.dm` files. See [react-native.config.js](./react-native.config.js) and the project asset setup.

### Native permissions

Microphone permission is required. iOS speech-recognition permissions may also be required depending on the flow you enable.

### Android sharing support

The example can share recorded wake-word audio. On Android that uses a `FileProvider`, which is why the app manifest references `share_file_paths.xml`.

## Relevant files

- [App.tsx](./App.tsx): top-level app container, React state, screen flow, and JSX
- [src/README.md](./src/README.md): detailed source-map for the extracted feature modules
- [src/appflow.ts](./src/appflow.ts): shared app constants and flow helpers
- [src/initialization/](./src/initialization): startup, permission, and speech-init helpers
- [src/stt/](./src/stt): STT transcript merge logic and speech callback registration
- [src/tts/](./src/tts): TTS constants, model assets, and intro speech flow
- [src/wakeword/](./src/wakeword): wakeword config, bootstrap, listener, capture, and sharing helpers
- [src/speaker_verification/](./src/speaker_verification): onboarding and verification helpers
- [src/aichat/](./src/aichat): Gemini request helpers and AI-chat speech/session helpers
- [package.json](./package.json): example dependencies
- [AndroidManifest.xml](./android/app/src/main/AndroidManifest.xml): Android permissions and file sharing
- [share_file_paths.xml](./android/app/src/main/res/xml/share_file_paths.xml): Android file-sharing resource

## New source structure

The example no longer keeps all of the voice logic in one giant file.

The original `App.tsx` was broken into reusable logic modules under `src/` so developers can lift individual features into their own React Native app with less effort.

### `App.tsx` now focuses on

- React state and refs
- top-level app flow
- prompt transitions
- screen rendering
- styles

### `src/` now contains the reusable logic

#### `src/appflow.ts`
- shared app constants and UI-facing helpers
- includes speaker-verification thresholds and score-display helpers

#### `src/initialization/`
- microphone permission helpers
- speech-library initialization helpers
- TTS model-selection prompt flow
- startup timing helpers like `withTimeout(...)`

#### `src/stt/`
- STT merge logic for partial/final transcripts
- `Speech.onSpeechError`
- `Speech.onSpeechStart`
- `Speech.onSpeechEnd`
- `Speech.onSpeechPartialResults`
- `Speech.onSpeechResults`
- Android-specific partial-results guard during initialization

#### `src/tts/`
- TTS constants and model assets
- wakeword intro speech flow
- reusable TTS-related helpers

#### `src/wakeword/`
- wakeword model/config constants
- listener attach/detach helpers
- wakeword startup/bootstrap flow
- wakeword detection capture helpers
- wakeword recording-share helpers
- iOS audio-routing config used by wakeword flows

#### `src/speaker_verification/`
- enrollment JSON load/save helpers
- onboarding flow
- endless verification/runtime verification helpers

#### `src/aichat/`
- Gemini request and streaming helpers
- speech queue handling for AI-chat replies
- AI-chat session reset/finish helpers

## How to copy pieces into your app

If you only need one feature from this example, these are the best starting points:

- Wakeword only:
  - start with [src/wakeword/index.ts](./src/wakeword/index.ts)
- Speaker verification onboarding + verification:
  - start with [src/speaker_verification/onboarding.ts](./src/speaker_verification/onboarding.ts) and [src/speaker_verification/verification.ts](./src/speaker_verification/verification.ts)
  - also use [src/appflow.ts](./src/appflow.ts) for SV-related thresholds/UI helpers
- STT + TTS interaction loop:
  - start with [src/stt/index.ts](./src/stt/index.ts), [src/tts/index.ts](./src/tts/index.ts), and [src/initialization/index.ts](./src/initialization/index.ts)
- Gemini voice chat:
  - start with [src/aichat/index.ts](./src/aichat/index.ts) plus the STT/TTS modules above

## Important note about behavior preservation

This refactor was intentionally done as a move/extract refactor, not as a redesign.

The goal of the new structure is:

- keep the same voice behavior
- preserve the Android/iOS-specific logic
- preserve the STT/TTS/wakeword pause-resume orchestration
- make the example easier to understand and easier to copy feature-by-feature

## Search-friendly summary

If you found this example while searching for:

- React Native wake word example
- React Native speaker identification example
- React Native speech to text example
- React Native text to speech example
- React Native offline voice AI

this demo is intended to cover the full mobile voice flow rather than only one feature in isolation.

## Questions and support

For production integration help, licensing, custom wake words, or full voice AI support, contact `info@davoice.io`.

## Speaker verification onboarding

To get the best results of Speaker Verification signature please use the following in your onboarding:

> [Wake Word], Please send a message to my friend. How's the weather going to be today? Please set a timer for three minutes. Can you play some music for me?

And if you want to make it even stronger add:

> Every morning, I enjoy a fresh cup of coffee while watching the beautiful sunrise.

For example - the following is a perfect onboarding:

> "Hey Coach, Please send a message to my friend. How's the weather going to be today? Please set a timer for three minutes. Can you play some music for me? Every morning, I enjoy a fresh cup of coffee while watching the beautiful sunrise."
