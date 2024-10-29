// BackgroundTimerSetup.js
import { NativeModules, NativeEventEmitter } from 'react-native';

const BackgroundTimerModule = NativeModules.BackgroundTimer;
if (BackgroundTimerModule) {
  BackgroundTimerModule.addListener = BackgroundTimerModule.addListener || (() => {});
  BackgroundTimerModule.removeListeners = BackgroundTimerModule.removeListeners || (() => {});
}

export const BackgroundTimerEmitter = new NativeEventEmitter(BackgroundTimerModule);
