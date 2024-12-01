// KeyWordRNBridge.js
import { NativeModules, NativeEventEmitter } from 'react-native';
import {
    Platform,
  } from 'react-native';
  
const { KeyWordRNBridge } = NativeModules;
const keywordRNBridgeEmitter = new NativeEventEmitter(KeyWordRNBridge);

const setKeywordDetectionLicense = async (license) => {
    return await KeyWordRNBridge.setKeywordDetectionLicense(license);
};

const initKeywordDetection =  async (modelName, threshold, buffer_cnt) => {    
    return await KeyWordRNBridge.initKeywordDetection(modelName, threshold, buffer_cnt);
};

const replaceKeywordDetectionModel = async (modelName, threshold, buffer_cnt) => {
    return await KeyWordRNBridge.replaceKeywordDetectionModel(modelName, threshold, buffer_cnt);
};

const getKeywordDetectionModel = async () => {
    return await KeyWordRNBridge.getKeywordDetectionModel();
};

//const getRecordingWav = (bla) => {
const getRecordingWav = async (bla) => {
    console.log("Calling RN bridge functionality getRecordingWav: ", KeyWordRNBridge.getRecordingWav);
    if (Platform.OS === 'ios') {
        return await KeyWordRNBridge.getRecordingWav(bla);
    }
    return await KeyWordRNBridge.getRecordingWav();
};

const startKeywordDetection = async () => {
    await KeyWordRNBridge.startKeywordDetection();
};

const stopKeywordDetection = async () => {
    await KeyWordRNBridge.stopKeywordDetection();
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

