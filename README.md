# ReactNative KeywordsDetection by Davoice

<p style="font-family: Arial, sans-serif; font-size: 16px;">
Welcome to <strong>Davoice KeywordsDetection</strong> – the premier keyword detection solution designed by <strong>DaVoice</strong>.
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

<h2>Contact us @ frymanofer@gmail.com </h2>
<ul>
  <li>We have full support for Ract-Native. This repository is being build in the meanwhile please contact us at frymanofer@gmail.com</li>
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
  <li><Provide the model file name, you do not have to provide a path the code will find the file for you.</li>
  <li>Provide the threashold - recommended 0.9999 to prevent any false positive.</li>
  <li>Provide the falsePositiveChecks - recommended setting of #2:</li>

      try {
          let modelParams = {modelName:"my_key_word.onnx", /* replace with your model */ 
              threshold: 0.9999, /* false positive sensitivity */ 
              falsePositiveChecks: 2} /* How many checks for false positives */
Initialize the detection:

          const result = await KeyWordRNBridge.initKeyWord(modelParams.modelName, modelParams.threshold, modelParams.falsePositiveChecks);
Setup the callback:

          KeyWordRNBridge.onKeyWordEvent((event) => {
              onKeyWordDetected(event);
          });
Now we are set - you can start listening and detect key words:

          KeyWordRNBridge.startKeyWord();
    } catch (e) {
        console.log("ERROR loadDavoice", e);
    }
</ul>
