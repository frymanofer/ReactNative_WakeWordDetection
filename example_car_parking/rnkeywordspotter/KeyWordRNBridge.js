// KeyWordRNBridge.js
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { KeyWordRNBridge } = NativeModules;
const keywordRNBridgeEmitter = new NativeEventEmitter(KeyWordRNBridge);

export class KeyWordRNBridgeInstance {
    instanceId;
    listeners = [];
  
    constructor(instanceId) {
      this.instanceId = instanceId;
    }
  
    createInstance(
      modelName,
      threshold,
      bufferCnt) 
      {
      return KeyWordRNBridge.createInstance(
        this.instanceId,
        modelName,
        threshold,
        bufferCnt
      );
    }

    setKeywordDetectionLicense(license) {
        return KeyWordRNBridge.setKeywordDetectionLicense(this.instanceId, license);
    }

    replaceKeywordDetectionModel(modelName, threshold, bufferCnt) {
        return KeyWordRNBridge.replaceKeywordDetectionModel(this.instanceId, modelName, threshold, bufferCnt);
    }

    setKeywordLicense(license) {
        return KeyWordRNBridge.setKeywordLicense(this.instanceId, license);
    }

    startKeywordDetection(threshold) {
        return KeyWordRNBridge.startKeywordDetection(this.instanceId, threshold);
    }

    stopKeywordDetection() {
        return KeyWordRNBridge.stopKeywordDetection(this.instanceId);
    }

    destroyInstance() {
        return KeyWordRNBridge.destroyInstance(this.instanceId);
    }

    onKeywordDetectionEvent(callback) {
        const listener = keywordRNBridgeEmitter.addListener('onKeywordDetectionEvent', (event) => {
            if (event.instanceId === this.instanceId) {
                callback(event.phrase);
            }
        });
        this.listeners.push(listener);
    }

    removeListeners() {
        this.listeners.forEach((listener) => listener.remove());
        this.listeners = [];
    }
}

export const createKeyWordRNBridgeInstance = async (instanceId) => {
    return new KeyWordRNBridgeInstance(instanceId);
};
