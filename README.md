# ReactNative KeywordsDetection by Davoice

[![GitHub release](https://img.shields.io/github/release/frymanofer/KeyWordDetectionIOSFramework.svg)](https://github.com/frymanofer/KeyWordDetectionIOSFramework/releases)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

By [DaVoice.io](https://davoice.io)

[![Twitter URL](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Ftwitter.com%2FDaVoiceAI)](https://twitter.com/DaVoiceAI)


Welcome to **Davoice KeywordsDetection** – the premier keyword detection solution designed by **DaVoice.io**.

## Features

- **High Accuracy:** Our advanced machine learning models deliver top-notch accuracy.
- **Easy to deploy with React Native:** Check out our example: "rn_example/DetectingKeyWords.js". With a few simple lines of code, you have your own keyword detecting enabled app.
- **Cross-Platform Support:** Integrate Davoice KeywordsDetection into React-Native Framework. Both iOS and Android are supported.
- **Low Latency:** Experience near-instantaneous keyword detection.

## Platforms and Supported Languages

- **React-Native Android:** React Native Wrapper for Android.
- **React-Native iOS:** React Native Wrapper for iOS.

## Contact

For any questions, requirements, or more support for React-Native, please contact us at info@davoice.io.

## Installation and Usage

### npm install - package

(Soon to be released. You will be able to use: `npm install react-native-davoice-keywordsdetection`)

### Demo Instructions

To run the demo:

1. Clone the repository:
   ```
   git clone https://[YourGittName]:[Token].com/frymanofer/ReactNative_WakeWordDetection.git
   ```

2. Navigate to the example directory:
   ```
   cd example
   ```

3. For Android:
   ```
   npm run android
   ```
   Depending on your system, you may be required to press "a" for Android.

   **Note:** If you don't have an Android environment setup (Gradle, Android device or Emulator, Java, etc.) and need help, please contact us at ofer@davoice.io.

4. For iOS:
   ```
   npm run ios
   ```
   Depending on your system, you may be required to press "i" for iOS.

   **Note:** If you don't have an iOS environment setup (Xcode, CocoaPods, iOS device or Emulator, etc.) and need help, please contact us at ofer@davoice.io.

## Images

   <img src="./Audio%20Permission%20Prompt.jpeg" alt="Audio Permission Prompt" width="300"/></br>
1. **Audio Permission Prompt:**
   The app is requesting permission to record audio, necessary for wake word detection.

   <img src="./Microphone%20Settings.jpeg" alt="Microphone Settings" width="300"/></br>
2. **Microphone Settings:**
   The settings screen showing virtual microphone configuration in the Android emulator.

   <img src="./Listening%20for%20Wake%20Word.jpeg" alt="Listening for Wake Word" width="300"/></br>
3. **Listening for Wake Word:**
   The app is actively listening for the wake word "Need Help Now."

   <img src="./Wake%20Word%20Detected.jpeg" alt="Wake Word Detected" width="300"/></br>
4. **Wake Word Detected:**
   The app has detected the wake word "Need Help Now."

### Usage Example

Below is a simple JavaScript code showing how to use Davoice KeywordsDetection:

```javascript
// Import the main class
import KeyWordRNBridge from 'react-native-davoice-keywordsdetection';

// Setup your callback on keyword / wakeword detected
const onKeyWordDetected = async (keywordIndex) => {
  // Do whatever you need on callback
  // Stop searching for Keywords if it makes sense - KeyWordRNBridge.stopKeyWord();
};

// Setup and activate keywords detection
try {
  let modelParams = {
    modelName: "my_key_word.onnx", // replace with your model
    threshold: 0.9999, // false positive sensitivity
    falsePositiveChecks: 2 // How many checks for false positives
  };

  // Initialize the detection
  const result = await KeyWordRNBridge.initKeywordDetection(
    modelParams.modelName, 
    modelParams.threshold, 
    modelParams.falsePositiveChecks
  );

  await KeyWordRNBridge.setKeywordDetectionLicense(
          "MTcyODkzOTYwMDAwMA==-XPLwWg6m4aFC9YMJZu0d0rKIh2AsExYixyeCpiVQmpE="); // Set a valid license!!!!

  // Setup the callback
  KeyWordRNBridge.onKeywordDetectionEvent((event) => {
    onKeyWordDetected(event);
  });

  // Now we are set - you can start listening and detect key words
  KeyWordRNBridge.startKeywordDetection();
} catch (e) {
  console.log("ERROR loadDavoice", e);
}
```

## Benchmark.

Our customers have benchmarked our technology against leading solutions, including Picovoice Porcupine, Snowboy, Pocketsphinx, Sensory, and others. 
In several tests, our performance was comparable to Picovoice Porcupine, occasionally surpassing it, however both technologies consistently outperformed all others in specific benchmarks. 
For detailed references or specific benchmark results, please contact us at ofer@davoice.io.

## Activating Microphone while the app operates in the background or during shutdown/closure.
This example in the Git repository enables Android functionality in both the foreground and background, and iOS functionality in the foreground. However, we have developed an advanced SDK that allows the microphone to be activated from a complete shutdown state on Android and from the background state on iOS. If you require this capability for your app, please reach out to us at ofer@davoice.io.

#### Example for iOS Background State

Apple restricts background microphone access for privacy and battery efficiency. However, certain applications, such as security apps, car controlling apps, apps for the blind or visually impaired may require this functionality.

Below is an example for one of the workarounds we have done in order to activate microphone with an empty listener. This approach avoids unnecessary battery usage until real audio capture is needed, at which point you can swap the placeholder listener with the actual microphone callback.

The example below, built in React Native, demonstrates this approach. The function backgroundMicEmptyListener() creates a minimal listener with negligible CPU impact, only processing the function call and return.

```javascript
const handleAppStateChange = (nextAppState) => {
  console.log("handleAppStateChange(): ", nextAppState);
  
  if (nextAppState === 'background') {
    console.log("nextAppState === 'background'");
    BackgroundJob.start(backgroundMicEmptyListener, backgroundOptions)
      .then(() => {
        console.log('Background job started successfully');
      })
      .catch((err) => {
        console.error('Error starting background job:', err);
      });
  }
}
```

## Links

Here are wakeword detection GitHub links per platform:

- **For React Native:** [ReactNative_WakeWordDetection](https://github.com/frymanofer/ReactNative_WakeWordDetection)
- **For Android:** [KeywordsDetectionAndroidLibrary](https://github.com/frymanofer/KeywordsDetectionAndroidLibrary)
- **For iOS framework:** 
  - With React Native bridge: [KeyWordDetectionIOSFramework](https://github.com/frymanofer/KeyWordDetectionIOSFramework)
  - Sole Framework: [KeyWordDetection](https://github.com/frymanofer/KeyWordDetection)
