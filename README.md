# KeyWordDetectionIOSFramework

[![GitHub release](https://img.shields.io/github/release/frymanofer/KeyWordDetectionIOSFramework.svg)](https://github.com/frymanofer/KeyWordDetectionIOSFramework/releases)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Made in Israel by [DaVoice.io](https://davoice.io)

[![Twitter URL](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Ftwitter.com%2FDaVoiceAI)](https://twitter.com/DaVoiceAI)

Welcome to the iOS Framework for KeyWordDetection by DaVoice.io. This framework provides robust keyword detection capabilities on iOS, and can be used natively or within React Native projects.

## Table of Contents

- [KeyWordDetectionIOSFramework](#keyworddetectioniosframework)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installation](#installation)
    - [Native iOS Integration](#native-ios-integration)
    - [React Native Integration](#react-native-integration)
  - [Demo Instructions](#demo-instructions)
  - [Quick Start](#quick-start)
  - [Usage](#usage)
  - [Support](#support)
  - [Links](#links)

## Features

- Robust keyword detection for iOS devices
- Compatible with native iOS and React Native projects
- High accuracy and low latency
- Easy integration with existing projects

## Installation

### Native iOS Integration

To integrate the framework natively into your iOS project, follow these steps:

1. **Download the Framework:** Manually add the KeyWordDetection framework to your Xcode project.

2. **Modify Your Podfile:** Add the necessary dependencies and configurations.

   ```ruby
   target 'MyProjectName' do
     # Your existing configurations...
     # DAVOICE REQUIRED CONFIGURATION
     use_frameworks! :linkage => :static
     # Required Pods
     pod 'onnxruntime-objc', '~> 1.18.0'
     pod 'ios-voice-processor', '~> 1.1.0'
   end
   ```

   **Note:** We are working on supporting various linkage types; currently, linkage must be static.

### React Native Integration

To use this framework in a React Native project, visit our [React Native setup page](https://github.com/frymanofer/ReactNative_WakeWordDetection).

## Demo Instructions

To run the demo:

1. Clone the repository:
   ```
   git clone [repository URL]
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

## Quick Start

1. Follow the native installation instructions - Download and install KeyWordDetection iOS framework in Xcode and make changes to the Podfile as in the above instructions.
2. Install React Native:
   ```
   npm install react-native
   ```

## Usage

Here's an example of how to use the framework with React Native:

```javascript
// Import the main class
// import KeyWordRNBridge from 'react-native-davoice-keywordsdetection'; // Not yet available
import KeyWordRNBridge from './rnbrigedspotter/KeyWordRNBridge';

// Setup your callback on keyword / wakeword detected
const onKeyWordDetected = async (keywordIndex) => {
  // Do whatever you need on callback
  // Stop searching for Keywords if it makes sense - KeyWordRNBridge.stopKeyWord();
};

// Setup and activate keywords detection
async function setupKeywordDetection() {
  try {
    let modelParams = {
      modelName: "my_key_word.onnx", // replace with your model
      threshold: 0.9999, // false positive sensitivity
      falsePositiveChecks: 2 // How many checks for false positives
    };

    // Initialize the detection
    const result = await KeyWordRNBridge.initKeyWord(
      modelParams.modelName, 
      modelParams.threshold, 
      modelParams.falsePositiveChecks
    );

    // Setup the callback
    KeyWordRNBridge.onKeyWordEvent((event) => {
      onKeyWordDetected(event);
    });

    // Now we are set - you can start listening and detect key words
    KeyWordRNBridge.startKeyWord();
  } catch (e) {
    console.log("ERROR loadDavoice", e);
  }
}
```

## Support

For any questions or support, please contact us at:

- Email: info@davoice.io
- Website: [DaVoice.io](https://davoice.io)

## Links

Here are wakeword detection GitHub links per platform:

- **For React Native:** [ReactNative_WakeWordDetection](https://github.com/frymanofer/ReactNative_WakeWordDetection)
- **For Android:** [KeywordsDetectionAndroidLibrary](https://github.com/frymanofer/KeywordsDetectionAndroidLibrary)
- **For iOS framework:** 
  - With React Native bridge: [KeyWordDetectionIOSFramework](https://github.com/frymanofer/KeyWordDetectionIOSFramework)
  - Sole Framework: [KeyWordDetection](https://github.com/frymanofer/KeyWordDetection)
