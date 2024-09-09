import KeyWordRNBridge from 'KeyWordRNBridge';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const GetAudioPermission = async () => {
    const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
    await request(permission);
    const status = await check(permission);
    if (status !== RESULTS.GRANTED) {
        await request(permission);
    }
}


const onKeyWordDetected = async (keywordIndex: any) => {
// Do whatever you need on callback
// Stop searching for Keywords if it makes sense - KeyWordRNBridge.stopKeyWord();
};

const initKeyWordsDetection = async () => {
    GetAudioPermission()
}

const loadDavoice = async () => {
    try {
            let modelParams = {modelName:"my_key_word.onnx", /* replace with your model */ 
                threshold: 0.9999, /* false positive sensitivity */ 
                falsePositiveChecks: 2} /* How many checks for false positives */
            console.log(modelParams); // Check the model name
            const result = await KeyWordRNBridge.initKeyWord(modelParams.modelName, modelParams.threshold, modelParams.falsePositiveChecks);
            console.log(result);
            KeyWordRNBridge.onKeyWordEvent((event) => {
                console.log('KeyWord event detected:', event);
                onKeyWordDetected(event);
            });
            KeyWordRNBridge.startKeyWord();
    } catch (e) {
        console.log("ERROR loadDavoice", e);
    }
};
