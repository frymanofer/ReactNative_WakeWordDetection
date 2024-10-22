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

const getKeywordDetectionModel = () => {
    return KeyWordRNBridge.getKeywordDetectionModel();
};

//const getRecordingWav = (bla) => {
const getRecordingWav = (bla) => {
    console.log("Calling RN bridge functionality getRecordingWav: ", KeyWordRNBridge.getRecordingWav);
    if (Platform.OS === 'ios') {
        return KeyWordRNBridge.getRecordingWav(bla);
    }
    return KeyWordRNBridge.getRecordingWav();
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
    getKeywordDetectionModel,
    getRecordingWav,
    setKeywordDetectionLicense,
};

