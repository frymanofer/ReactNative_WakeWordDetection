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

### Install the package

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

## Background Detection

### Android
On Android, we build the capability to activate our code from complete shutdown. This means you will be able to trigger a notification or activate a task that will activate DaVoice Wake Word detection.

### iOS
Unfortunately, on iOS, we found it impossible to start listening while the app is completely shut down. We have found the workaround below to be able to listen to the microphone on iOS in the background.

#### iOS Background Workaround

Apple does not want you to listen when the app is in the background. However, some applications such as security applications may require it.

Since on iOS it is impossible to start recording from the background, the idea is to activate the microphone with empty code - meaning not wasting battery until you need to listen and then you replace the microphone callback with the real listener.

Here is an example built in React Native. Note that the function `backgroundMicEmptyListener()` creates an empty listener with no CPU usage except for the call to the function and return.

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
