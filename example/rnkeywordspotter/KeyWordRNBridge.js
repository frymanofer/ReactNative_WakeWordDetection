// KeyWordRNBridge.js
import { NativeModules, NativeEventEmitter } from 'react-native';
import {
    Platform,
  } from 'react-native';
  
const { KeyWordRNBridge } = NativeModules;
const keywordRNBridgeEmitter = new NativeEventEmitter(KeyWordRNBridge);

const setKeywordDetectionLicense = (license) => {
    return KeyWordRNBridge.setKeywordDetectionLicense(license);
};

const initKeywordDetection = (modelName, threshold, buffer_cnt) => {    return KeyWordRNBridge.initKeywordDetection(modelName, threshold, buffer_cnt);
};

const replaceKeywordDetectionModel = (modelName, threshold, buffer_cnt) => {
    return KeyWordRNBridge.replaceKeywordDetectionModel(modelName, threshold, buffer_cnt);
};

const gerKeywordDetectionModel = () => {
    return KeyWordRNBridge.gerKeywordDetectionModel();
};

//const gerRecordingWav = (bla) => {
const gerRecordingWav = (bla) => {
    console.log("Calling RN bridge functionality gerRecordingWav: ", KeyWordRNBridge.gerRecordingWav);
    if (Platform.OS === 'ios') {
        return KeyWordRNBridge.gerRecordingWav(bla);
    }
    return KeyWordRNBridge.gerRecordingWav();
};

const startKeywordDetection = () => {
    KeyWordRNBridge.startKeywordDetection();
};

const stopKeywordDetection = () => {
    KeyWordRNBridge.stopKeywordDetection();
};

// Event listeners
const onKeywordDetectionEvent = (callback) => {
    return keywordRNBridgeEmitter.addListener('onKeywordDetectionEvent', callback);
};

export default {
    initKeywordDetection,
    startKeywordDetection,
    stopKeywordDetection,
    onKeywordDetectionEvent,
    replaceKeywordDetectionModel,
    gerKeywordDetectionModel,
    gerRecordingWav,
    setKeywordDetectionLicense,
};

