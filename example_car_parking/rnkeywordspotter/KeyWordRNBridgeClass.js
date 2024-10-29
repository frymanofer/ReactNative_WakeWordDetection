import { NativeModules, NativeEventEmitter } from 'react-native';
import { Platform } from 'react-native';

const { KeyWordRNBridge } = NativeModules;

class KeyWordRNBridgeWrapper {
    constructor(instanceId, isSticky) {
        this.instanceId = instanceId; // Unique identifier for each instance
        this.isSticky = isSticky;
        this.eventEmitter = new NativeEventEmitter(KeyWordRNBridge); // New EventEmitter per instance
    }

    setKeywordDetectionLicense(license) {
        return KeyWordRNBridge.setKeywordDetectionLicense(license, this.instanceId);
    }

    initKeywordDetection(modelName, threshold, buffer_cnt) {
        return KeyWordRNBridge.initKeywordDetection(modelName, threshold, buffer_cnt, this.instanceId);
    }

    replaceKeywordDetectionModel(modelName, threshold, buffer_cnt) {
        return KeyWordRNBridge.replaceKeywordDetectionModel(modelName, threshold, buffer_cnt, this.instanceId);
    }

    startKeywordDetection() {
        KeyWordRNBridge.startKeywordDetection(this.instanceId);
    }

    stopKeywordDetection() {
        KeyWordRNBridge.stopKeywordDetection(this.instanceId);
    }

    onKeywordDetectionEvent(callback) {
        return this.eventEmitter.addListener(`onKeywordDetectionEvent-${this.instanceId}`, callback);
    }

    removeKeywordDetectionEvent(listener) {
        listener.remove();
    }
}

// Factory to create multiple instances
export const createKeyWordRNBridgeInstance = (instanceId, isSticky) => {
    return new KeyWordRNBridgeWrapper(instanceId, isSticky);
};
