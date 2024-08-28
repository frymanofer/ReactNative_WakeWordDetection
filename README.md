# ReactNative KeywordsDetection by Davoice

<p style="font-family: Arial, sans-serif; font-size: 16px;">
Welcome to <strong>Davoice KeywordsDetection</strong> – the premier keyword detection solution designed by <strong>DaVoice.io</strong>.
</p>

<h2>Features</h2>
<ul>
  <li><strong>High Accuracy:</strong> Our advanced machine learning models deliver top-notch accuracy.</li>
  <li><strong>Easy to deploy with React Native:</strong> check out our example: "rn_example/DetectingKeyWords.js" with a few simple lines of code you have your own key word detecting enabled app .</li>
  <li><strong>Cross-Platform Support:</strong> Integrate Davoice KeywordsDetection into React-Native Framework both iOS and Android supported.</li>
  <li><strong>Low Latency:</strong> Experience near-instantaneous keyword detection.</li>
</ul>

<h2>Platforms and Supported Languages</h2>
<ul>
  <li><strong>React-Native Android:</strong> React Native Wrapper for Android.</li>
  <li><strong>React-Native IOS:</strong> React Native Wrapper for IOS.</li>
</ul>

<h2>Contact us @ info@davoice.io </h2>
<ul>
  <li>For any questions / requirements and more support for Ract-Nativeplease contact us at info@davoice.io</li>
</ul>

<h2>Step by step instructions:</h2>
<ul>

<strong>Install the package</strong> (soon to be released and you can use: npm install react-native-davoice-keywordsdetection)


<strong>Below is a simple js code of how to use:

Import the main class:</strong>

  import KeyWordRNBridge from 'react-native-davoice-keywordsdetection';

<strong>Setup your callback on keyword / wakeword detected:</strong>

  const onKeyWordDetected = async (keywordIndex: any) => {
    // Do whatever you need on callback
    // Stop searching for Keywords if it makes sense - KeyWordRNBridge.stopKeyWord();
  };

<strong>Setup and activate keywords detection:</strong> 
  <li>Provide the model file name, you do not have to provide a path the code will find the file for you.</li>
  <li>Provide the threashold - recommended 0.9999 to prevent any false positive.</li>
  <li>Provide the falsePositiveChecks - recommended setting of #2:</li>

      try {
          let modelParams = {modelName:"my_key_word.onnx", /* replace with your model */ 
              threshold: 0.9999, /* false positive sensitivity */ 
              falsePositiveChecks: 2} /* How many checks for false positives */
<strong>Initialize the detection:</strong>

          const result = await KeyWordRNBridge.initKeyWord(modelParams.modelName, modelParams.threshold, modelParams.falsePositiveChecks);
<strong>Setup the callback:</strong>

          KeyWordRNBridge.onKeyWordEvent((event) => {
              onKeyWordDetected(event);
          });
<strong>Now we are set - you can start listening and detect key words:</strong>

          KeyWordRNBridge.startKeyWord();
    } catch (e) {
        console.log("ERROR loadDavoice", e);
    }
</ul>

<h2>Using Keywords / Wake word detection while the app is in the background or in shutdown state</h2>

Android: On Android we build the capability to activate our code from complete shutdown. This means you will be able to trigger a notification or activate a task that will activate DaVoice Wake Word detection.
IOS: Unfortunately on IOS we found it impossible to start listening while the app is completely shut down. We have found the workaround below to be able to listen to the microphone on IOS in the background.

<h2>IOS ONLY !!! If you require your IOS app to work from the background:</h2>

Apple do not want to you listen when the app is in the background. 
However some applications such as security application may require it.

Since on IOS it is impossible to start recording from the background The idea is to activate the microphone with empty code - meaning not wasting battery until you need to listen and then you replace the microphone callback with the real listener.

Here is an example I built in react native Not that the function below - backgroundMicEmptyListener() creates an empty listener with no CPU usage except the call to the function and return.


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

<h2>Links</h2>
<ul>
Here are wakeword detection github links per platform:
<li><strong>For react Native got to:</li>  https://github.com/frymanofer/ReactNative_WakeWordDetection
<li><strong>For Android:</li>
  https://github.com/frymanofer/KeywordsDetectionAndroidLibrary
<li><strong>For IOS framework:</li>
   With React Native bridge: https://github.com/frymanofer/KeyWordDetectionIOSFramework <br>
   Sole Framework: https://github.com/frymanofer/KeyWordDetection
</ul>

