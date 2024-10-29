// KeyWordRNBridge.js
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { KeyWordRNBridge } = NativeModules;
const keywordRNBridgeEmitter = new NativeEventEmitter(KeyWordRNBridge);

export class KeyWordRNBridgeInstance {
    instanceId;
    listeners = [];
    isFirstInstance = false;
  
    constructor(instanceId, isSticky) {
      this.instanceId = instanceId;
      this.isSticky = isSticky;
    }
  
    createInstance(
      modelName,
      threshold,
      bufferCnt) 
      {
      instance = KeyWordRNBridge.createInstance(
        this.instanceId,
        modelName,
        threshold,
        bufferCnt
      );
      if (instance && this.isFirstInstance)
      {
        this.isFirstInstance = false;
        KeyWordRNBridge.startForegroundService(this.instanceId); 
      }
      return instance;
    }

    setKeywordDetectionLicense(license) {
        return KeyWordRNBridge.setKeywordDetectionLicense(this.instanceId, license);
    }

    replaceKeywordDetectionModel(modelName, threshold, bufferCnt) {
        return KeyWordRNBridge.replaceKeywordDetectionModel(this.instanceId, modelName, threshold, bufferCnt);
    }
    /*startForegroundService() {
        return KeyWordRNBridge.startForegroundService(this.instanceId);
    }

    stopForegroundService() {
        return KeyWordRNBridge.stopForegroundService(this.instanceId);
    }*/
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

export const createKeyWordRNBridgeInstance = async (instanceId, isSticky) => {
    return new KeyWordRNBridgeInstance(instanceId, isSticky);
};
