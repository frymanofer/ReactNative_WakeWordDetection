// KeyWordRNBridge.js
import { NativeModules, NativeEventEmitter } from 'react-native';

const { KeyWordRNBridge } = NativeModules;
const keywordRNBridgeEmitter = new NativeEventEmitter(KeyWordRNBridge);

const initKeyWord = (modelName, threshold, falsePositiveChecks) => {
    return KeyWordRNBridge.initKeyWord(modelName, threshold, falsePositiveChecks);
};

const startKeyWord = () => {
    KeyWordRNBridge.startKeyWord();
};

const stopKeyWord = () => {
    KeyWordRNBridge.stopKeyWord();
};

// Event listeners
const onKeyWordEvent = (callback) => {
    return keywordRNBridgeEmitter.addListener('onKeyWordEvent', callback);
};

export default {
    initKeyWord,
    startKeyWord,
    stopKeyWord,
    onKeyWordEvent,
};

