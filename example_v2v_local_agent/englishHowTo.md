# How-to: the DaVoice voice-to-voice local agent example (React Native)

> For developers who use, test or copy parts of this example app
> (`example_v2v_local_agent/` in the ReactNative_WakeWordDetection repository). Everything here was checked against the code (last update: 2026-11-17,
> `react-native-davoice-llm` 1.0.15: the core with every feature marked "development core" in 2.3,
> plus Local confidence, 2.6). File paths are relative to `example_v2v_local_agent/`. A Brazilian
> Portuguese version is in `portugueseHowTo.md`.

> **Status: test models, still in training.** The car demo's on-device model ("DaVoice
> Automotive Agent 0.6B", checkpoint `g3c_it3639`, the default since 2026-11-17) is **a test
> model, not a finished product**. On a sealed set of 128 new sentences it never saw (run once,
> Brazilian Portuguese and English, same core and settings as the app):
> - **86%** of the car commands (92 of 107) ended in exactly the right action (tool and
>   arguments); the model's first call alone was exactly right for 92% of them;
> - **2 of 128** turns ran a wrong action, with **no opposite action** ("open" for "close") and
>   **no unsupported action**; background speech and fragments were never acted on;
> - 6 complete commands were answered with "say it again" instead of acting.
>
> Compared with the previous model (`r8d_it150`) on the same tests: on 474 new pt-BR commands the
> final result is right 90.7% of the time instead of 84.2%, and a wrong action runs 6.5% of the
> time instead of 10.1%; in long conversations (12 conversations, 169 turns) 89% of the turns are
> right instead of 81%, and short follow-ups ("o do passageiro", "não, pra mim") 78% instead of 49%.
> Every car action is **simulated** and checked by the app before it runs (guards, 2.3), and the
> **Local confidence** setting (2.6) can send uncertain commands to a remote agent instead. Treat
> the results as a preview of the voice pipeline, not as final accuracy.

The app demonstrates a voice assistant that runs on the device itself:

- wake word;
- speaker verification (speaker identification);
- speech recognition (STT) and speech synthesis (TTS), with voice cloning;
- two local AI demos (an LLM on the device) with tools:
  - **Car demo:** a simulated Volkswagen car (windows, doors, locks, climate, navigation,
    radio...);
  - **Calories demo:** a calorie tracker and personal memory.

Packages used (`package.json`):

| Package | What for |
|---|---|
| `react-native-wakeword` | wake word + speaker verification (onboarding and verification) |
| `react-native-davoice` | STT + TTS (`Speech`), voice cloning, speaker filter on STT |
| `react-native-davoice-llm` (1.0.15) | on-device LLM, `Agent` (a whole assistant turn), tools, call guards, Local confidence |
| `react-native-fs` | files: voice signature, downloaded models and language packs, saved prompt states, the agent's database |

What is built into the app and what is downloaded (and how to change it): see 1.5.

---

## 1. Using the app, step by step

### 1.1 Run the app

```bash
cd example_v2v_local_agent       # no Git LFS needed: no voice model is inside this app (1.5)
npm install            # the project uses npm / package-lock.json
cd ios && pod install && cd ..
npx react-native run-android     # or: npx react-native run-ios
```

- In a *debug* build the JavaScript comes from Metro (`npx react-native start`). On Android
  with the phone on USB: `adb reverse tcp:8081 tcp:8081`.
- **Android release build:** `cd android && ./gradlew :app:assembleRelease`.
  - `android/gradle.properties` gives Gradle 8 GB for packaging the APK.
  - No voice model is inside the APK: every language is downloaded when it is chosen (1.5).
  - `android/app/build.gradle` rebuilds the JS bundle when only the agent packs (`agent/`,
    `agent_automotive/`) or the tool JSON in `src/` change.
- JS logs on Android: `adb logcat | grep ReactNativeJS`.
- The DaVoice license keys are in the example's code. In another app, use your own
  (contact: info@davoice.io).

### 1.2 Startup flow

1. **Language.** The first screen asks for the language: English, Português do Brasil,
   Português de Portugal, German, Greek, Spanish, French, Italian, Dutch, Danish or Swedish.
   - **No language is built into this app.** Every language, English and Brazilian Portuguese
     included, is downloaded the first time it is chosen: its button shows "⬇ N MB", and choosing it opens
     the **Downloading language pack** screen (progress, MB, Retry, Back). The app continues
     only when the download is complete. Details and configuration: 1.5.
   - Hebrew is supported in the code but hidden from this screen (`hidden: true` in
     `APP_LANGUAGES`), and it is neither built in nor downloadable (its voice is for
     non-commercial use only).
   - The choice sets:
     - the TTS model (e.g. `model_ex2_rich_kate.dm` for English,
       `model_ex2_portuguese_brv1.dm` for pt-BR; built in or downloaded, see 1.5);
     - the voice-cloning encoder (`embedder_*.dm`, which goes with its model);
     - the STT locale (`en-US`, `pt-BR`, ...);
     - the language the LLM replies in;
     - the agent pack's language (`agent/` or `agent/pt-BR/`, and the same under
       `agent_automotive/`).

   Configuration: `APP_LANGUAGES` in `src/appflow.ts` (the languages offered) and
   `language_packs.json` (the files of each language, built in or downloaded; see 1.5).
2. **Microphone permission.** Accept.
3. **Loading.** The app loads the wake word and STT/TTS. On Android "Preparing voice
   demo..." can show for a few seconds.
4. **Spoken introduction.** The narration is in `src/narration.ts`, one entry per
   language.
5. **Voice.** You can:
   - pick a built-in voice;
   - pick a voice you cloned earlier;
   - **clone a new voice** from a recording (`src/tts/voiceClone.ts`).
6. **Speaker verification** (details in 1.3). Three options: create a new voice signature,
   use the saved one, or skip.
7. **Wake word.** The narration says "Now say the wake word…". This example's wake word is
   **"Hey Coach"** (model `hey_coach_model_28_22012026b.dm`), in every language.
8. **Mode**, after the wake word:

| Mode | What it does |
|---|---|
| **Local AI · Car demo** | STT → on-device Automotive Agent → TTS, with the simulated car |
| **Local AI · Calories demo** | STT → on-device Personal Agent → TTS, with the calorie tracker and memory |
| Full AI Chat | STT → Gemini (cloud) → TTS. Needs a valid Gemini key. |
| Combined STT + TTS | you speak and hear the text back |
| STT Only | shows the transcript only |
| Type to TTS | you type and the app speaks |

To get back to the mode choice, use the app's back button (`goBackToModeSelection` in
`App.tsx`).

### 1.3 Speaker verification: setup and why it matters

**What it is:** the app records a *voice signature* of the owner (enrollment) and then
compares every utterance against it.

**How to do the onboarding in the app:**
1. At the speaker-verification step, choose **create a new signature**.
2. The app collects **5 speech samples** (`SV_ONBOARDING_SAMPLE_COUNT` in
   `src/appflow.ts`). Say natural sentences, one per sample, in a quiet room, at the
   distance you normally hold the phone.
   - Suggested text (from the README): *"Hey Coach, Please send a message to my friend.
     How's the weather going to be today? Please set a timer for three minutes. Can you
     play some music for me? Every morning, I enjoy a fresh cup of coffee while watching
     the beautiful sunrise."*
3. The signature is saved to `Documents/sv_enrollment.json`
   (`writeEnrollmentJsonToFile` in `src/speaker_verification/onboarding.ts`). Next time,
   choose **use the saved signature**.
4. When it is done, the app enrolls the speaker live in the wake word **and** in STT
   (`applySpeakerVerificationChoice` in `App.tsx`):
   ```ts
   await wakewordInstance.addSpeaker(SV_SPEAKER_ID, enrollmentJsonPath); // react-native-wakeword
   await Speech.addSpeaker(SV_SPEAKER_ID, enrollmentJsonPath);           // react-native-davoice
   ```
   If the user skips, the app calls `setSpeakers([])` on both. An empty list turns the
   filter off.
5. Decision threshold: `SV_DECISION_THRESHOLD` in `src/appflow.ts` (0.34 on Android, 0.35
   on iOS).

**Why it matters, especially in a car.** Without verification, any voice nearby can command
the assistant: a passenger, the radio, someone outside the window. With verification on:
- the wake word only fires for an enrolled voice;
- every STT result says **who** spoke: `speakerIds` (every verified speaker in the
  sentence) and `speakerId` (the latest). See `SpeechResultsEvent` in
  `react-native-davoice`.

**This example already does it for the doors.** The door tools `open_door` and `unlock_car`
declare an authorization scope in `src/car/carToolDefinitions*.json`:
```json
"execution": { "authorization": { "scope": "door_locks", "message": "Unlock the car?" } }
```
The agent core **never runs** such a tool without a "yes" from the app. It sends an
`authorizeTool` request to `onRequest`, and `isToolAuthorized` in `src/agent/LocalAgent.ts`
answers with `ownerMayAct()` (`src/speaker_verification/currentSpeaker.ts`):
- speaker verification **off** (skipped): allowed (it's a demo);
- verification **on**: allowed only if the enrolled owner was verified in this request.
  Another voice gets "not authorized", and nothing opens.

Other scopes are refused unless listed in `AUTHORIZED_TOOL_SCOPES` (empty). For a plain
yes/no confirmation without a speaker check, a tool declares `execution.confirmation`
instead; the example does this for `send_message`, where the app shows a dialog.

### 1.4 Sample commands

Say "Hey Coach", wait for the app to listen, then say a command.

- **Car demo, English:**
  - windows: "open the rear right window", "close the front left window", "open the
    passenger window halfway", "close all the windows", "open the back windows";
  - doors and locks: "open the rear left door", "close the doors", "lock the car", "unlock
    the driver's door";
  - climate: "set the temperature to 22 degrees", "two degrees warmer", "set the passenger
    side to 20", "fan on level three", "turn on the windshield defrost";
  - media: "play some jazz", "tune to 98.5 FM", "turn the volume up";
  - navigation: "take me home", "how long until we get there?", "find a gas station on the
    way";
  - status: "how much range do I have?".
- **Car demo, Brazilian Portuguese** (the main language of this model):
  - "abre o vidro traseiro direito", "fecha o vidro do carona", "abre os vidros de trás";
  - "abre a porta traseira esquerda", "tranca o carro", "destranca a porta do motorista";
  - "coloca o ar em vinte e dois graus", "deixa o lado do passageiro em vinte",
    "coloca 20 graus pro motorista e 23 pro passageiro";
  - "liga o desembaçador do para-brisa", "sintoniza noventa e oito vírgula cinco",
    "me leva pra Campinas", "quanto tempo falta?".
- **Incomplete requests (the app should ask):**
  - "open a window" → "Which window?";
  - "turn on the defrost" → "Front or rear?".
- **Calories demo:**
  - "I had two eggs";
  - "how many calories today?";
  - "undo".
- **Conversation and knowledge (both demos):**
  - "who are you?" (fixed reply from the pack's `fixedReplies`);
  - "what can you do in the car?" (fixed list of car functions);
  - "tell me a fun fact about Brazil": the model hands it over; with no remote model set up,
    the app answers with the message in 2.2.

---

### 1.5 What ships in the app and what is downloaded

Only what every user needs is inside the app. The large files are downloaded the first time
they are needed (never at install) from DaVoice's Cloudflare R2
(`https://pub-27f94b1602c647ab95a601086cf52820.r2.dev`), and each one is checked by sha256.

| What | Where | When |
|---|---|---|
| Wake word (`hey_coach_model_28_22012026b.dm`), speaker verification (`sv.dm`) | in the app | always |
| Agent packs (`agent/`, `agent_automotive/`), car tools JSON, narration | in the app | always |
| TTS model + voice-cloning encoder of every language (en, pt-BR, pt-PT, de, es, fr, it, nl, da, sv, el; 136–170 MB each) | R2 `language-packs/<file>` → phone `Documents/language_packs/<language>/` | the first time the language is chosen |
| On-device models (GGUF, 382 MB each): Automotive Agent `auto16_g3c_it3639`, Personal Agent `ft7f2_it900` | R2 `agent-llm/<file>` → phone `Documents/local_llm/models/` | the first time the demo opens |
| Pre-warmed state of the Automotive Agent, English or pt-BR (about 430 MB) | R2 `agent-llm/prewarm/<file>` → next to the model | with the model, for the app's language |

**Configuration of the language files: `language_packs.json`** (in `example_v2v_local_agent/`):

```json
{
  "baseUrl": "https://pub-27f94b1602c647ab95a601086cf52820.r2.dev/language-packs",
  "bundled": [],
  "languages": {
    "fr": {
      "model":    { "file": "model_ex2_french.dm", "bytes": 144455696, "sha256": "7c8044b4…" },
      "embedder": { "file": "embedder_fr.dm",      "bytes": 22320622,  "sha256": "31d7787d…" }
    }
  }
}
```

- `bundled`: the languages built into the app (none in this example). Every other language in
  `languages` is downloaded from `baseUrl/<file>`.
  - To build a language in, add its id to `bundled`. Its two files must be in
    `assets/models/`. Each one adds about 136–168 MB to the app.
  - To make a language a download, remove it from `bundled`. Its files must be on R2 under
    `language-packs/` with the same names.
- Nothing else needs editing. Metro only ships files that appear in a static `require()`, so
  the app can't read the JSON at runtime. Instead, `metro.config.js` runs
  `scripts/generate-language-packs.js` on every bundle (dev server, Android release, iOS). It
  writes `src/tts/languagePacks.generated.ts` with the `require()`s of the bundled files and
  the file table of all languages.
  - A wrong config (unknown language, missing file, wrong size) stops the build with a
    message.
  - Run it by hand: `node scripts/generate-language-packs.js`.
  - After replacing a file in `assets/models/`, run it with `--rehash` (it updates `bytes`
    and `sha256`), then upload the new file to R2 with the same name.
- Code:
  - `src/tts/languagePacks.ts`: download (to a temporary file, then sha256, then moved into
    place), free-space check, cancel, and a check on start (file present with the right size);
  - `src/tts/index.ts`: `languageFile()` picks the built-in file, else the downloaded one;
  - `App.tsx`: `selectAppLanguage` and the download screen.
- The speech library takes a downloaded file's absolute path the same way as a built-in
  asset (Android and iOS).

**The on-device models and pre-warmed states** are listed in `src/local_llm/constants.ts`
(`url`, `sizeBytes`, `sha256`, and `prebuiltStates` per language). The demo's loading screen
downloads the model and the pre-warmed state of the app's language together, with one
progress bar (2.1). A pre-warmed state only fits the exact model file, agent pack, tools and
prompt settings it was made with: after changing any of them, make new states on a phone
(the app saves one after its first warm-up), upload them, and update their `sha256` and
`sizeBytes`.

**Remote voice manifest** (development, 2026-11-12): installed apps can get new voice files
without an app update.
- At start the app fetches `<baseUrl>/manifest.json` in the background. It is used only when
  its Ed25519 signature verifies with the public key in `src/tts/languagePacks.ts` (DaVoice
  keeps the private key outside every repository), its schema is one the app reads, and every
  entry is valid (file name, size, sha256). Anything else: the built-in config.
- It can only change which voice files a downloaded language uses: never code, never the
  on-device LLM, never a built-in language. The files still come from the same folder and are
  sha256-checked.
- Each version is stored in its own folder (`language_packs/<language>/<version>/`) and used
  only once both files are complete; the last version that loaded (`markLanguagePackWorking`)
  is kept, and a new version that fails to load is rolled back (`rollbackLanguagePack`).

**Hosting rules:**
- Upload first, then check every public URL (HTTP 200, the download's sha256), and only then
  put a URL into the app. Never guess a URL.
- Before deleting a file from R2, make sure no app lists it any more (every DaVoice example app).
  An install that already has a file keeps using it.

DaVoice's other example apps (React Native with English and pt-BR built in, Expo, Flutter) use the same
R2 folder, the same language files and the same on-device models and pre-warmed states.

## 2. The local AI demos: what to expect and how to test them

### 2.1 The two demos, their models and the loading screen

| | Car demo | Calories demo |
|---|---|---|
| Model (default) | **DaVoice Automotive Agent 0.6B** | **DaVoice Personal Agent 0.6B** |
| Agent pack (system prompt) | `agent_automotive/` (no calorie skill) | `agent/` + `agent/skills/calories/` |
| Tools | the simulated car (`src/car/`, 22 tools) | calories, memory, web search |
| Card | Car card | Calories card |
| Database | `davoice_agent*_car.db` | `davoice_agent*.db` |

- **Implementation:** `src/local_llm/demo.ts` holds the current demo, and
  `LOCAL_LLM_DEMO_DEFAULT_MODEL` in `src/local_llm/constants.ts` sets each demo's model.
  - Car demo (since 2026-11-17): **DaVoice Automotive Agent 0.6B**,
    `LOCAL_LLM_DAVOICE_AUTOMOTIVE_G3C` (checkpoint `g3c_it3639`, h3d tool wording, about 380 MB,
    downloaded once and checked by sha256), with its pre-warmed state for English or Brazilian
    Portuguese (about 430 MB, downloaded with the model), so the first start skips the warm-up.
    The R2 files were checked by downloading them and comparing size and sha256.
  - The older Automotive models (r8d_it150, r4b_it100) were removed; a phone that had one picked uses this one.
  - Calories demo: the Personal Agent, `ft7f2_it900`.
  - DaVoice's other example apps (React Native, Expo, Flutter) list the same models.
- **Other models:** each demo remembers its own pick from **Change** (model picker,
  `src/local_llm/ModelPicker.tsx`). The picker also lists the experimental C3 and A
  checkpoints (backups: not hosted, only when the file is copied into the models folder) and
  larger general models (Qwen2.5 1.5B/3B, Gemma 3n). The larger ones are slower.
  - The older ft7c, ft7e and ft7f2 Automotive entries were removed. A phone that had one
    picked falls back to its demo's model.
  - Only one model is in memory at a time: picking another one replaces it.
  - A demo's earlier pick wins over a new default: on a phone where another model was picked
    in the car demo, pick the Automotive Agent in **Change** (or clear the app's data).
- **Loading screen:** after you pick a demo, the app shows its own loading screen with
  three steps until the model is ready:
  1. Download (progress bar; the model and, if it has one, its pre-warmed state, 1.5);
  2. Load into memory;
  3. Warm up.

  It shows the seconds spent in each step, and on an error, Retry and Back.
- **Chat screen:** only at "Ready" does the app switch to a clean screen with:
  - the car status (or the calories card) at the top;
  - **You said** (the live STT);
  - **Reply** (what is spoken);
  - the model name with **Change**;
  - in the car demo, **Local confidence** with **Change** (2.6);
  - Reset Chat and Back.
- **Warm-up and the saved state:** the warm-up processes the system prompt (persona +
  tools: about 3,100 tokens for the car demo and about 4,000 for calories).
  - **Car demo, English or pt-BR: pre-warmed.** The Automotive Agent comes with this
    processed prompt already made (downloaded with the model, 1.5), so even the first start
    restores it. Measured on the S20: restore 0.23 s, first answer 0.34 s, instead of a
    24.6 s warm-up. It works because the model uses `promptOrder: 'cache'` (the date comes
    after the tools, so the saved prompt fits every day).
  - **Otherwise, the first time** for each demo and language it takes about **30–40 s** on a
    Galaxy S20 (CPU). The app then **saves that processed prompt** (`*.kvstate` in the
    models folder, about 435 MB) with `saveState` from `react-native-davoice-llm`.
  - **Afterwards** the state is restored (`loadState`) in **under a second**, and "Ready"
    comes right away. Measured on the S20: restore 0.7–0.9 s, warm-up 0.5–0.6 s.
  - States are kept **per prompt** (demo, language, tools): the newest 2 per model file.
    Switching demos is fast after each demo's first warm-up.
  - With the trained prompt order (the Personal Agent), a new day still pays part of the
    warm-up, because the date sits near the top of the prompt.
  - Code: `warmUp` in `src/aichat/provider.ts`; `kvStatePath`, `stablePromptKey` and
    `downloadPrebuiltState` in `src/local_llm/ModelManager.ts`.

### 2.2 How a turn works

- The fine-tuned model decides on its own, every sentence: call a tool, ask (incomplete
  request), decline (not supported) or **hand it over** to a remote model.
- **The app says what was done.** After a car action the model does not speak: the tool's
  own sentence, built from the real result, is said and the turn ends. Code: `done()` /
  `say` in `src/car/carTools.ts`, sent with `toolReply`. The sentence names the action,
  position, zone and value, in English or Brazilian Portuguese:
  - success: "I opened the rear right window." / "Coloquei o lado do motorista em 20°C e o do
    passageiro em 23°C.";
  - already in that state: "The front right door is already locked.";
  - refused by the car: "The car is locked. Should I unlock it?", "I can't do that while
    the car is moving." Nothing changes, and the model never acts on its own after a
    refusal (it used to unlock the car by itself);
  - lookups (arrival time, range, tires) are answered by the app with the values.

  Nothing is announced before the tool confirms it.
- **What gets handed over:** general knowledge, writing, small talk. The 0.6B model was
  trained to **act** (tools), not to chat.
- **Remote model: current setup.** **No remote model is set up**
  (`LOCAL_LLM_LAYER2 = 'none'` in `src/local_llm/constants.ts`).
  - Everything handed over gets this fixed reply: **"I need to send this to a remote Model.
    To make this work, please setup a remote model in the App."** (pt-BR: *"Preciso enviar
    isso para um modelo remoto. Para isso funcionar, configure um modelo remoto no
    aplicativo."*). The text is in `LOCAL_LLM_NO_REMOTE_MESSAGE`.
  - A request the model understood but the demo can't do gets
    `LOCAL_LLM_NOT_IN_DEMO_MESSAGE`: "This is not available in this demo, to make it
    available please contact info@davoice.io".

  These messages are **expected**, not errors.
- **How to set up a remote model.** Change `LOCAL_LLM_LAYER2`:
  - `'cloud'`: the app sends the request to Gemini (`src/aichat/remote.ts`, key
    `GEMINI_API_KEY` in `local.config.ts`). The agent says a short filler while it waits;
    if Gemini fails, it says it couldn't.
  - Any other service: implement `answerRemoteRequest` in `src/aichat/remote.ts`. It
    receives the request (`query`, `userText`, history, memory facts, tool results) and
    returns `{ text }`, or `{ failure, detail }` on error.
  - `'device'`: a second model on the phone (`LOCAL_LLM_LAYER2_MODEL`, about 470 MB).
    **Not recommended:** both models compete for the same CPU.
- **Speech noise:** short transcripts that are only filler ("The.", "But.", "é...",
  "Alma Alma.") get "Sorry, I didn't catch that. Could you say it again?" without going to
  the model. In the car demo, a bare "Done." from the model is replaced the same way, since
  real actions are confirmed by the app's own sentence. Code: `src/aichat/fragments.ts`.
- **Web search** (calories demo): Wikipedia by default. Tavily or Brave need a key in
  `local.config.ts`.
- **Spoken replies:** each sentence goes to TTS as soon as it is ready. The text shows on
  screen before the voice.

### 2.3 What to expect (honestly)

- It is a **0.6B-parameter model on a phone**. It picks the right tool most of the time,
  but it still makes mistakes, for example:
  - in English, "open the windows" sometimes picks the door tool;
  - wrong side or zone;
  - absolute vs. relative ("22 degrees" vs. "two degrees warmer");
  - spoken numbers.
- **The core's guards** check every call against the user's words before it runs
  (`callGuards: 'correct'` in the model entry). They:
  - fix an obviously wrong argument: "close" vs. "open", "levanta o vidro" = close,
    "turn the defrost off", the side the user named, a split number;
  - normalize a value written in another word order ("right front" → `front_right`);
  - **block** a call to the wrong kind of object, e.g. a door tool for a window, with a
    natural "Sorry, I'm not sure I got that right. Could you say it again?". A blocked call
    is **never** turned into another tool;
  - block a call whose arguments belong to another tool;
  - take the value the user named (`enumWords`, development core 2026-11-12): "joga o ar nos
    pés" → `feet`, "acha um estacionamento" → `parking`, "quanto tem de combustível" → `fuel`,
    only when the words name exactly one value of that argument (two or none: unchanged);
  - read a plural without a place as all of them ("Can you open my car windows?", "fecha os
    vidros" → `all`); any place word ("back", "de trás", "do carona", "meu") leaves the call
    alone;
  - keep the action in a correction that only changes the target: "close the rear left
    window" → "no, the other one at the back" closes the rear right one (`followUp`; it needs
    the model entry's `historyAsRun: true`, so the history shows each call as it ran);
  - more, from the development core of 2026-11-13:
    - a value the user names in a correction is never undone: "open the sunroof" → "no, just
      tilt it" tilts;
    - one side named ("drop the passenger side two degrees") → the dual-zone tool is the
      wrong tool (the retry below picks the one-side tool);
    - a number after "to" / "pra" is a target: "sobe a temperatura pra vinte" = 20, not +20
      ("aumenta em dois" stays a step);
    - "roll down the windows" opens them; a crack needs "a little", "um pouco", "uma fresta";
    - named values: "pedágio" → `tolls`, "pen drive" → `usb`, AM / FM, seat heater vs.
      ventilation, "no 1" → `low` (read from the argument's own description), "casa" →
      `home`, "jantar" → `restaurant`;
    - named objects: a gas station, a pen drive, seat heating, "autonomia" (range). A tool
      that can't handle them is the wrong tool.
    - (later the same day, from speech-like test phrasings) a number the user
      never said is never run ("onde eu ponho etanol" → dual-zone 19 / 18: blocked); a number
      for a tool that takes none ("o ar do passageiro em 22" → air direction), a step on a
      target-only tool ("dá mais dois graus" → 23 / 23) and a radio number as a temperature
      ("noventa e três ponto três" → 93 °C) are the wrong tool;
    - a pure feeling ("tô suando", "tá um gelo aqui") is not a sunroof / window call; "a
      trava" / "o trinco" is the lock; a defroster is not "desce os vidros"; the windshield,
      consumption, tires, the tank, tolls and "onde eu carrego / paro" each need a tool that
      handles them; the glovebox is unsupported; a negated object ("não quero a porta, quero o
      vidro") is not named;
    - how far: "a couple of inches" / "um pouquinho" / "um dedinho" = crack (a sunroof: tilt),
      "all the way" / "de vez" = open; "bring / get / put / roll … down" opens, "… up" closes;
      noun first ("os vidros do carro, baixa") counts;
    - "lado dela / her side" = passenger ("meu lado" = driver); "tira o embaçado" = defrost on,
      "chega de desembaçador" = off; "liga o som de novo" = unmute; a radio value outside its
      band (FM 87.5–108, AM 530–1710) becomes the one number said; "meu serviço" = `work`;
      seat levels "fraquinho" / "médio" / "forte".

    These are wrong-*tool* blocks where the model should choose again, so they use the retry
    below. A block is never turned into another tool by the app.

  Every guard decision is in the log (`guard ...`).
- **One retry when the model picked the wrong tool** (development core 2026-11-12; the model
  entry's `guardRetry: true`). When a guard blocks a call because it is the wrong *tool* (a
  door tool for "close the windows", the dual-zone tool for one side), the same model
  reconsiders **once**, from the same already processed prompt, with that tool (and every other
  tool that can't handle what the user named) excluded. Its new call passes every guard again;
  the same tool, no call or another block → the user is asked, as before. The app never
  substitutes a tool.
  - It fixed "close the windows" after "open the windows" (the model called `close_doors`
    every time): 12 → 22 of 22 turns on the phone-regression set, 40 / 40 on a window / door
    sequence set; on the Galaxy S20 it adds about 1.5–2 s to the turns where it fires (about
    3% of turns).
  - With the 2026-11-13 core, the Automotive Agent r8d_it150 gets 156 of 161 pt-BR
    acceptance turns right (was 149), with 12 wrong actions (was 27) and no opposite or
    unsupported action. On the Galaxy S20 the action is ready about 1.7 s after the recognized
    text reaches the model (median; 2.2 s for 9 turns in 10), with 1.8 GB peak memory.
  - With the latest development core of 2026-11-13: 157 of 161 (10 wrong actions, none
    opposite or unsupported). On new, speech-like phrasings (fillers, "ô", "aí", other word
    orders) that test set doesn't have, wrong actions drop from about 28% to about 15% of
    turns (right ones from about 70% to 81%). The cost: the retry fires on about 20% of such
    turns, and a retried turn takes about 3.6 s on the S20 (2.0 s otherwise).
  - Lock vs. open / close (development core g29): a lock word ("trava", "tranca", "lock") on a
    tool that only opens / closes doors, or an open / close word on a lock tool, is a wrong-tool
    block (the retry above). "fecha o carro" / "abre o carro" (Brazilian for lock / unlock) stay
    with the lock tools. "trava o carro" with no door named locks the whole car.
- **Two operations in one request** (development core g29; the model entry's
  `maxOperations: 2`, sent as agent configure `maxOperations`). "fecha os vidros e trava o
  carro" runs both, one after the other, in the same session (same model, same processed
  prompt).
  - The core cuts the sentence at "e" / "and" / "depois" / "then" / "também" / a comma only
    where each piece is a clear command ("fecha os vidros e as portas" → "fecha as portas" for
    the second). It does not cut a self-correction ("abre... quer dizer, fecha"), names
    ("Zezé di Camargo e Luciano"), numbers ("vinte e dois"), one place for two things ("o vidro
    do motorista e o do passageiro", "o motorista em 20 e o passageiro em 23"), a wish
    ("queria um ventinho, ...") or a vague first part ("esquenta um pouquinho, sobe dois graus").
  - Each operation is decided by the model on its own words and checked by every guard. The
    second sees the first in its history and never runs a call the first already ran.
  - The replies are said one after the other ("Fechei todos os vidros. Tranquei o carro."), so
    a partial success is reported as it happened. A third request is not done; the user hears
    "Não fiz o resto do pedido. Pode repetir?" (`agent_automotive` `prompts.notDoneRest`).
  - The result's `operationTurns` is kept with the reply in the history
    (`AIChatHistoryMessage.operationTurns`); the core replays the request as its operations, so
    the next turn reuses the processed prompt.
  - Cost on the Galaxy S20: the second operation adds about 3 s (about 2 s of prompt + 1.2 s
    of decoding), partly hidden while the first reply is spoken.
- **Positions:** windows, doors and locks take `front_left`, `front_right`, `rear_left`,
  `rear_right`, `driver`, `passenger`, `front`, `rear`, `left`, `right` or `all`.
  - `driver` / `passenger` are resolved by the app from the car's steering-wheel side
    (`CarState.vehicle.steering`, default left; `setSteering()` in `src/car/CarState.ts`),
    so nothing assumes left-hand drive.
  - The steering side also goes to the core (agent configure `vehicle: { steering }`, sent
    again when it changes; development core g29). A side said for a front seat ("o banco da
    direita", "lado direito 22 graus") is the driver or the passenger by it. An explicit
    left / right keeps its physical meaning: "o vidro do lado direito" is `front_right`, also
    when the model said `passenger` in a right-hand-drive car. Without the setting the core
    assumes nothing.
  - Window movement, door opening and door locking are separate tools.
- **Two temperatures at once:** `set_dual_zone_temperature` (driver + passenger). The app
  checks each value and says which side it couldn't set. r4b was trained on it and gets most
  two-temperature requests right, in either order ("o carona quer 26 e eu 19"). A one-side
  request ("passenger side 22") uses `set_temperature` with a zone.
  - Coming with `react-native-davoice-llm` 1.0.14 (core g11): a `dualZone` guard puts the values
    the user said on the right sides of the dual call, and blocks (asks again) a call that would
    drop or copy a side. It never turns one tool into another.
- **Values out of range** ("set the fan to 29"; the fan goes from 1 to 7): with 1.0.13 the user
  hears the generic "could you say it again?". From 1.0.14, the pack strings `outOfRange` /
  `outOfRangeAsk` (already in `agent_automotive/agent.json` and `pt-BR/`) say the range instead:
  "Sorry, 29 isn't possible: it goes from 1 to 7."; a number the user never said is asked
  for.
- **Latency (Galaxy S20, CPU only, measured 2026-11-10):**
  - the model's decision takes about 1.3–2 s per command;
  - the action's sentence is spoken right after.

  iPhones with Metal are faster.
- **User memory (calories demo):** a saved fact can occasionally leak into an unrelated
  answer. This is a known limitation of the current model.
- Requests the car can't do (hood, trunk, hazard lights, wipers, mirrors, parking brake)
  should be **declined**, not executed.

### 2.4 How to test

Debug builds only (`__DEV__`): **Continue without wake word (dev)** on the wake-word screen
starts the app as if "Hey Coach" was heard, and **Run test script (dev)** on the chat screen
plays the lines of `files/inapp_test.txt` (in the app's files folder; `#reset` starts a new
conversation) as if spoken. Neither exists in a release build.

1. Choose **Local AI · Car demo** (or Calories). Wait for the loading screen to finish:
   about 30–40 s the first time, about a second afterwards.
   - To test the saved state: close the app completely, open it again and go back to the
     demo. The log shows `[LocalLLM] KV state restored: N tokens in X ms`.
   - Ask a general question ("tell me a fun fact about Brazil"): the answer should be the
     remote-model message from 2.2.
2. **Car card** (`src/car/CarCard.tsx`):
   - the latest action in words and the **exact call** the AI made, e.g.
     `set_window(window: rear_right, position: open)`;
   - the two actions before it;
   - a one-line car state: temperature per side, windows, open doors, locks;
   - **Parked / Driving** button: while driving, the app refuses the trunk, the charge port,
     rotating the screen, opening all windows, opening doors and some modes
     (`NOT_WHILE_DRIVING` in `src/car/carTools.ts`);
   - **Reset** button: resets the car.

   In the Calories demo the Calories card (`src/calories/CaloriesCard.tsx`) shows today's
   total and list.
3. **What to check for each command:**
   - the right tool;
   - the exact arguments (position, value, unit);
   - the spoken sentence matches what happened ("already…", refusals);
   - a question when information is missing;
   - a decline when it's not supported;
   - **no action run** on conversational sentences or speech noise.
4. **Registered tools:** `LOCAL_LLM_CAR_TOOLS` in `src/local_llm/constants.ts`:
   - `'vw_demo'` (default: 22 tools, shorter prompt, faster);
   - `'all'` (the whole catalog).

   The model entry's `toolWording` picks the description file:
   - `h3d` (`src/car/carToolDefinitions.h3d.json`: positions + dual zone, with the corrected
     descriptions the Automotive Agent models are trained with);
   - `h3`, `h2` (older models);
   - `v1` (the original wording of the first models).
5. **Conversation log:**
   - debug build: `adb shell run-as com.exampleapp cat files/davoice_chat.log`;
   - release build: `adb logcat | grep DavoiceChat` (same content).

   It shows the user's words, what the model generated, guard decisions, the tool calls and
   results, the reply, and `[timing]` lines with prompt and generation times.
6. **App tests:**
   ```sh
   npx jest __tests__/carTools.test.ts __tests__/fragments.test.ts
   ```
   These check the car's spoken replies (success / already / refused, English and pt-BR,
   positions, steering side, dual zone) and the speech-noise rules.
7. **With speaker verification on:** check that the wake word doesn't fire for another
   person, that `speakerId` shows in the STT results, and that another voice can't unlock
   the car.

### 2.5 Turn-based conversation: the user waits for the AI to finish

**How it works today.** The AI chat (local and Gemini) is **turn-based**. The user **cannot
interrupt** the AI:

1. The user speaks. When they go silent, the app sends the sentence to the AI.
2. At that moment STT is paused (`Speech.pauseSpeechRecognition()` in `processAIChatTurn`,
   `App.tsx`). While `aiChatInFlightRef` is set, STT results are ignored
   (`src/stt/index.ts`).
3. The AI thinks and speaks its reply, sentence by sentence.
4. Only after the last audio finishes does `finishAIChatSpeechFlow` reopen the microphone
   for the next turn.

While the AI thinks or speaks, nothing the user says is heard. Saying "Hey Coach" doesn't
stop the reply either, and there is no stop button. This is deliberate: it's the simplest
and safest way to keep the AI from hearing its own voice and transcribing what it is saying.

**If you want the user to be able to interrupt the AI, you have to change the app.** The pattern
below comes from a production DaVoice app (a fitness coach) where the user says the wake word over
the coach's voice and the coach stops at once. How to apply it here:

1. **The wake word keeps listening while the AI speaks** (STT stays closed). In that app,
   when the user's turn ends, STT closes and wake-word detection resumes
   (`unPauseDetection`) before the coach speaks. Here: call
   `myInstanceRef.current?.unPauseDetection()` right after `pauseSpeechRecognition()` in
   `processAIChatTurn`.
2. **Echo cancellation always on:** `AEC: { mode: 'always' }` in the audio routing config.
   Here, `defaultAudioRoutingConfig` in `src/wakeword/index.ts`
   uses `WakewordAEC: { regular: false, duringTTS: false }`. Replace it with
   `AEC: { mode: 'always' }`, so the AI's own voice neither triggers the wake word nor gets
   into STT. Support (documented in `react-native-wakeword`, `audioRoutingConfig.d.ts`):
   - newer iPhones use iOS's own AEC; older ones an echo-cancelling audio engine;
   - on Android it covers the wake word and TTS; STT on Android 13+, speaker routes.
3. **Wake word while the AI speaks = stop.** A wake word heard while the AI speaks always means
   "stop", before any other state. Here, at the top of `keywordCallback` in `App.tsx`:
   ```ts
   if (aiChatInFlightRef.current) {             // the AI is thinking or speaking
     if (interruptInFlightRef.current) return;  // the same "Hey Coach" detected twice
     interruptInFlightRef.current = true;
     try {
       aiChatRequestIdRef.current += 1;         // late text and events of the old turn are ignored
       (await getLocalAgent()).cancel();        // stops the LLM turn (src/agent/LocalAgent.ts)
       aiChatSpeechQueueRef.current = [];       // drops the sentences not spoken yet
       ignoreNextFinishedSpeakingRef.current = true; // the stop's "finished speaking" must not open another turn
       await Speech.stopSpeaking();             // silences the voice now
       resetSpeechTranscriptState();            // discards whatever STT caught meanwhile (never sent to the AI)
       aiChatInFlightRef.current = false;
       await myInstanceRef.current?.pauseDetection(false);
       await Speech.unPauseSpeechRecognition(-1, 0); // a new user turn; preFetchMs 0, see below
     } finally {
       interruptInFlightRef.current = false;
     }
     return;
   }
   ```
   `interruptInFlightRef` and `ignoreNextFinishedSpeakingRef` are new refs.
   `finishAIChatSpeechFlow` must honour the second one and not reopen the microphone again.
4. **Details learned in practice:**
   - **Guard against double detection** (a stop-in-flight flag): the same word can fire
     twice.
   - **Discard the accidental transcript; don't send it.** Interrupting the voice must not
     send the AI half a sentence or an echo of its own words.
   - **Open STT with `preFetchMs: 0`.** Otherwise STT replays the previous ~2 s of audio and
     transcribes "Hey Coach" (or the AI's voice) as the new message.
   - **Button vs. voice.** A stop button just goes silent. For the wake word it
     opens the microphone, because the user wants to talk.
   - **Play a short "listening" sound** when the microphone opens, so the user knows they
     can speak.
   - **History:** keep only the part of the reply that was actually spoken, so the next
     turn makes sense.
5. **In a car, combine it with speaker verification (1.3).** With a speaker enrolled, only
   the owner's voice can interrupt. The radio or a passenger can't.

**"Any speech interrupts" variant (duplex).** STT stays open under the AI's voice, with
`AEC 'always'`, and words that are **not** an echo of what the AI is saying stop the voice and start
a normal turn. It is more complex (the echo has to be filtered by comparing the transcript with the
sentence the AI is speaking) and, with DaVoice today, iOS only. For a car, the wake-word version
above is safer.

### 2.6 Local confidence: uncertain commands go to the remote agent

The car demo's chat screen has a **Local confidence** row with **Change**: Off (default) → 0.80 →
0.90 → 0.95 → Off. It is stored per install (`getLocalConfidence` / `setLocalConfidence` in
`src/local_llm/ModelRegistry.ts`) and sent to the agent before the next turn
(`agent.configure({ confidence: { min } })` in `src/aichat/provider.ts`; the calories demo always
sends 0).

- Each tool call the model writes has a probability: the product of the probabilities of the tokens
  the model picked (text the guide inserts is certain and not counted). A call below the setting
  **never runs**: no guard, no car action.
- The request then goes to the remote assistant with the reason `low-confidence`. With no remote
  model set up (`LOCAL_LLM_LAYER2 = 'none'`), `src/aichat/remote.ts` answers with
  `LOCAL_LLM_LOW_CONFIDENCE_MESSAGE`: **"For this command I need a remote agent."** (pt-BR: *"Para
  esse comando eu preciso de um agente remoto."*).
- The turn's result carries `confidence: { value, min, low }`; the log shows `confidence: 0.29 <
  0.80: the call did not run`.
- It needs `react-native-davoice-llm` 1.0.15 or newer (older cores ignore the setting). It does not
  change the prompt, so the pre-warmed states stay valid.

Measured with `g3c_it3639` on commands it was never trained on:

| Setting | Wrong actions removed | Valid commands sent to the remote agent |
|---|---|---|
| Off (default) | 0% | 0% |
| 0.80 | about 40% | about 13% |
| 0.90 | about two thirds | about 20% |
| 0.95 | about 70% | about 27% |

On harder phrasings (contrast pairs, spoken numbers) many more valid commands are sent away, and
some wrong calls are made with high confidence (for example "fexa as portas" → lock), so the
setting alone does not reach zero wrong actions. Choose the value with your own commands.

---

## 3. Extracting each component into another app

General rule: copy the **module** from `src/` and the listed **assets**, install the package
and use your own license. The `src/` modules were split out of `App.tsx` exactly for this
(see `src/README.md`).

### 3.1 Wake word (`react-native-wakeword`)

- **Code:** `src/wakeword/index.ts`:
  - `instanceConfigs` (model, threshold, buffer);
  - `initializeWakewordBootstrap`, `startWakewordDetection`;
  - `attachKeywordListenerOnce` / `detachKeywordListener`;
  - `pauseDetection` / `unPauseDetection`.
- **Minimal API:**
  ```ts
  import { createKeyWordRNBridgeInstance } from 'react-native-wakeword';
  const inst = await createKeyWordRNBridgeInstance('ww1', false);
  await inst.setKeywordDetectionLicense(LICENSE);
  await inst.createInstance('hey_coach_model_28_22012026b.dm', 0.999, 3);
  await inst.startKeywordDetection(0.999 /* ... */);
  ```
- **Assets:** the wake-word `.dm` model must be in the **native bundle**:
  - Android: `android/app/src/main/assets/hey_coach_model_28_22012026b.dm`;
  - iOS: added to the Xcode project (Copy Bundle Resources), as in this example.

  For another wake word, ask DaVoice for a model.
- **Before STT:** pause the wake word before opening STT (the example does this). Two
  capture pipelines open at once cause instability. The exception is the interruption
  pattern in 2.5, where the wake word listens while TTS plays and STT stays closed.

### 3.2 Speaker verification onboarding and verification (`react-native-wakeword` + `react-native-davoice`)

- **Code:**
  - `src/speaker_verification/onboarding.ts`: `runSpeakerVerifyEnrollment`,
    `runSpeakerVerificationStartupFlow`, `writeEnrollmentJsonToFile`,
    `loadEnrollmentJsonFromFile`;
  - `src/speaker_verification/verification.ts`: continuous or one-off verification;
  - `src/speaker_verification/currentSpeaker.ts`: who was verified in this request,
    `ownerMayAct()` (used to authorize the door tools, 1.3);
  - `src/appflow.ts`: threshold and sample count.
- **Asset:** `sv.dm` in the native bundle:
  - Android: `android/app/src/main/assets/sv.dm`;
  - iOS: in the Xcode project.

  The controller uses `modelPath: 'sv.dm'`.
- **Flow:**
  ```ts
  import { createSpeakerVerificationMicController, onSpeakerVerificationOnboardingDone } from 'react-native-wakeword';
  const ctrl = await createSpeakerVerificationMicController('svMic1');
  await ctrl.create(JSON.stringify({ modelPath: 'sv.dm', options: { decisionThreshold: 0.35 } }));
  await ctrl.beginOnboarding('davoice', 5, true);
  // 5x: await ctrl.getNextEmbeddingFromMic();  -> progress events; at the end onboardingDone carries enrollmentJson
  // save the JSON (react-native-fs) and enroll the speaker:
  await wakewordInstance.addSpeaker('owner', enrollmentJsonPath);
  await Speech.addSpeaker('owner', enrollmentJsonPath);
  ```
- **At STT startup:** you can also enroll the speaker at initialization:
  `Speech.initAll({ locale: 'en-US', model, onboardingJsonPath, speakerId: 'owner' })`.
- **Managing the speaker list:**
  - `setSpeakers([...])` replaces the whole list (empty = off);
  - `removeSpeaker(id)` removes one speaker;
  - `getSpeakerIds()` lists the enrolled ones.
- **Authorizing actions:** use `speakerId` / `speakerIds` from the STT results. See the
  door authorization in 1.3.

### 3.3 STT and TTS (`react-native-davoice`)

- **Code:**
  - `src/initialization/index.ts`: `initializeSpeechLibrary` (calls `Speech.initAll`),
    microphone permission;
  - `src/stt/index.ts`: result handlers, merging partial/final text;
  - `src/tts/index.ts`: model per language, voices, speeds;
  - `src/tts/voiceClone.ts`: voice cloning.
- **Assets:** one TTS model and one voice-cloning encoder per language, built in or
  downloaded (1.5):
  - TTS: `model_ex2_rich_kate.dm` (English), `model_ex2_portuguese_brv1.dm` (pt-BR, about
    145 MB), ...;
  - voice cloning: `embedder_en.dm`, `embedder_brv1.dm`, ...
  - Every `require()` of a `.dm` file ships it in the app, even if that code never runs. In
    this example the `require()`s are generated from `language_packs.json`; don't add one by
    hand.
  - `Speech.initAll` and `createVoiceClone` take either a `require()` or a file path, so a
    downloaded file works the same way (copy `src/tts/languagePacks.ts` for the download).
- **Minimal API:**
  ```ts
  import Speech from 'react-native-davoice/speech';
  await Speech.initAll({ locale: 'en-US', model: require('./assets/models/model_ex2_rich_kate.dm') });
  Speech.onSpeechResults = (e) => console.log(e.value[0], e.speakerId);
  await Speech.unPauseSpeechRecognition(-1);   // start listening
  await Speech.pauseSpeechRecognition();       // before speaking
  await Speech.speak('I opened the window.', 0, 1.0);
  ```
- **Voice cloning:**
  `Speech.createVoiceClone(recording, outputFolder + '/', require('./assets/models/embedder_en.dm'))`,
  then `Speech.setExternalVoicesPath(folder)` and `changeVoice(name)`. If the result has
  `warnings`, ask the user to record again.
- **Text for speech:** don't rewrite text for speech in the app (numbers, domains such as
  "DaVoice.io"). The TTS library already does that pre-processing.

### 3.4 Local AI and tools (`react-native-davoice-llm`)

- **Install:**
  ```sh
  npm install react-native-davoice-llm
  cd ios && pod install
  ```
  On Android, add the package's Maven repository in `android/build.gradle`:
  ```gradle
  allprojects { repositories { maven { url "${project(":react-native-davoice-llm").projectDir}/libs" } } }
  ```
- **Code to copy:**
  - `src/local_llm/`:
    - model list and URLs with sha256, plus each demo's default model (`constants.ts`);
    - the current demo (`demo.ts`);
    - download, registry with a model per demo, and the saved states (`ModelManager.ts`,
      `ModelRegistry.ts`);
    - loading (`LocalLLMLoader.ts`) and the picker (`ModelPicker.tsx`).
  - `src/agent/LocalAgent.ts`: creates the `Agent` with the demo's pack and language,
    `onRequest` (`remote`, `authorizeTool`, `confirmTool`). It also has `resetLocalAgent()`
    for switching demos.
  - `src/agent/AgentPack.ts`: picks `agent/` or `agent/pt-BR/`, and the car pack
    (`automotiveAgentFor`).
  - `src/aichat/remote.ts`: the remote model (`answerRemoteRequest`: the fixed messages,
    Gemini or your own service, see 2.2).
  - `src/aichat/provider.ts`: sets the agent up per model (tools, guards, remote model,
    warm-up, saved state per prompt with `saveState` / `loadState`) and streams to TTS.
  - `src/aichat/fragments.ts`: speech-noise rules.
  - **Agent packs** (JSON files: behaviour changes without code changes):
    - `agent/agent.json` + `agent/skills/calories/` (the calories demo; the same under
      `agent/pt-BR/`);
    - `agent_automotive/agent.json` + `agent_automotive/pt-BR/` (the car demo: the same
      persona and messages, no calorie skill). This is the system prompt the automotive
      model is trained with: keep it identical when you use that model.
  - **Car:**
    - `src/car/carToolDefinitions.h3d.json` (tool definitions in MCP shape: `name`,
      `description`, `inputSchema`, `execution`);
    - `src/car/carTools.ts` (handlers and the spoken sentences);
    - `src/car/positions.ts` (positions, steering side, sentence wording);
    - `src/car/CarState.ts` (simulated state);
    - `src/car/CarCard.tsx` (UI).

    Don't give a `.ts` module and a `.json` file the same base name: Metro resolves the
    `.json` first.
- **Minimal API:**
  ```ts
  import { setLicense, loadModel, Agent, toolReply } from 'react-native-davoice-llm';
  await setLicense(LICENSE);
  await loadModel(pathToGguf, { contextSize: 8192 });
  const agent = await Agent.create({
    pack: { agent: require('./agent_automotive/agent.json'), skills: [] },
    databasePath: `${RNFS.DocumentDirectoryPath}/davoice_agent_car.db`,
    chatTemplate: 'qwen3',
  }, { onRequest });
  await agent.configure({ intentRouter: false, webSearchTool: true, timeTool: true, guards: { /* see provider.ts */ } });
  await agent.setTools(myTools);   // a handler returns toolReply(result, 'I opened the window.') to say it itself
  const r = await agent.turn({ text, history }, (ev) => { if (ev.type === 'text') speak(ev.text); });
  // agent.cancel() stops a running turn (used for interruptions, see 2.5)
  ```
- **Models:** download the GGUF from the URLs in `src/local_llm/constants.ts` and check the
  sha256 (the example already does). Fine-tuned models need the same `chatTemplate`
  (`qwen3`) and the entry's settings (`usesRouter: false`, `modelTools: true`,
  `remoteAssistant: true`, `temperature: 0`, `callGuards: 'correct'`, `toolWording`; for the
  Automotive Agent also `historyAsRun: true`, `guidedToolCalls: true`, `promptOrder:
  'cache'` and `guardRetry: true`, plus its `prebuiltStates`). `provider.ts` sends
  them to `agent.configure` (`historyAsRun`, `guidedToolCalls`, `promptOrder`, and the
  `guards`, including `followUp`, `dualZone` from 1.0.14, and `enumWords` and `guardRetry` with
  the 2026-11-12 core). From 1.0.15 it also sends the Local confidence (`confidence: { min }`, 2.6).
- **New tools:** a small model depends heavily on the description text. Keep descriptions
  short and clear, and say explicitly "absolute vs. relative" and which side is which. Keep
  **the same text** in the app that the model was trained on: the car demo model expects
  `src/car/carToolDefinitions.h3d.json`.

---

## Quick test checklist

1. Install and run the app (1.1); choose a language. Every language is downloaded the first time
   (e.g. Brazilian Portuguese, then French): the download screen must show progress, and the app continues only when
   the download is complete (1.5). The second time, no download.
2. Pick a voice; **create the voice signature** (5 sentences); say **"Hey Coach"**.
3. Choose **Local AI · Car demo** → wait for the loading screen. The first time it downloads
   the model and its pre-warmed state (about 780 MB), then is ready in about a second (the
   calories demo: about 30–40 s the first time, about 1 s afterwards). General questions get the "set up a remote model" message
   (see 2.2).
4. Try the commands in 1.4. Check the car card (tool and exact arguments) and that the
   spoken sentence matches what happened.
5. Try **Local AI · Calories demo** the same way.
6. Remember the chat is turn-based (2.5): wait for the AI to finish before speaking again.
7. Also try a different voice: it must **not** activate the assistant, nor unlock the car.
8. In the car demo set **Local confidence** to 0.90 (2.6) and say a few commands: uncertain ones are not run and the app
   says "For this command I need a remote agent."; clear ones still run.
