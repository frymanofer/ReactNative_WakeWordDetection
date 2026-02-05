# SETUP

1. Make sure you have metro.config.js enabling onnx, dm, and other files as assets. Check the metro.config.js in this folder.


# Q&A

## IOS

1. Which AVAudioSession.Category does the library utilize?

You have full control on the category and options and you can define them differently for any device connected.
To see how it works please look at the our repository:https://github.com/frymanofer/reactNative_WakeWordDetection
If you already have it then do "git fetch && git pull"
Under the example: example_full_voice
In the file App.tsx:
You will see how to configure this, there is a configuration type/structure allowing you to control/configure the Audio configuration for any case you need:
import type { AudioRoutingConfig } from 'react-native-wakeword';...
And here is where you define the config:
const defaultAudioRoutingConfig: AudioRoutingConfig = {
So for example you can define that in carAudio (carPlay) you do not mixwithothers while on other configurations you do.
Before you start listening you need to call: await setWakewordAudioRoutingConfig(defaultAudioRoutingConfig);

2. Does it include the .mixWithOthers option?

Yes by default, however, you can define it differently - as in answer to question #1

3. Is wake word detection functional while other audio (e.g., music or podcasts) is playing?
Yes of course,  however you can define it differently - as in answer to question #1.

4. Does the library interrupt or duck concurrent audio?
Yes of course,  however you can define it differently - as in answer to question #1.

## Configuration:

5. Is it possible to control audio session behavior via the API?
Yes - see reply to question #1 above

6. Are there configuration options available to enable a non-interrupting mode?
I am not familiar with a complete non-interrupting mode as in IOS a phone call has higher priority than wake words, even siri.
So I would need more clarification on the behaviour you are looking for.

## Android:
1. Does the library call AudioManager.requestAudioFocus()?
Not for the wake word. We use requestAudioFocus for TTS (text to speech).

2. If so, what focus level is requested (e.g., AUDIOFOCUS_GAIN or AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)?
Not for wake words. For TTS We use AUDIOFOCUS_GAIN.  
We did try AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK. We can create an api to control this if required.

3. Can wake word detection operate during active audio playback?
Yes, of course.