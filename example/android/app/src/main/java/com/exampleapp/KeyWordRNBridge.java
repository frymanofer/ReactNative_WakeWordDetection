package com.exampleapp.keywordspotting;

import com.davoice.keywordsdetection.keywordslibrary.KeyWordsDetection;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import androidx.annotation.Nullable;
import ai.onnxruntime.*;
import android.util.Log;

public class KeyWordRNBridge extends ReactContextBaseJavaModule {

    private final String TAG = "KeyWordsDetection";
    private static final String REACT_CLASS = "KeyWordRNBridge";
    private static ReactApplicationContext reactContext;
    private KeyWordsDetection keyWordsDetection;
    private float keyThreshold = 0.9f;
 //   private String licenseKey = "MTcyNTEzODAwMDAwMA==-wXgQkH4ffgX3g3Tvn7YJZ/kVoTa5Mndi8xpoTqtdXfA=";
    public KeyWordRNBridge(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    private void onKeywordDetected(Boolean detected) {
        if (detected) {
            // Perform your desired action here
            callback();
        } else {
        }
    }

    @ReactMethod
    public void replaceKeywordDetectionModel(String modelName, float threshold, int buffer_cnt, Promise promise) {
        if (keyWordsDetection == null) {
            initKeywordDetection (modelName, threshold, buffer_cnt, promise);
            promise.resolve("replaceKeywordDetectionModel called initialized with model: " + modelName);
        }
        else {
            try {
                keyWordsDetection.replaceKeywordDetectionModel (reactContext, modelName, threshold, buffer_cnt);
                keyWordsDetection.initialize(this::onKeywordDetected);
            } catch (Exception e) {
                promise.reject("replaceKeywordDetectionModel: Error replacing model to: " + modelName);
            }
            promise.resolve("replaceKeywordDetectionModel called initialized with model: " + modelName);
        }
    }
        
    @ReactMethod
    public String getKeywordDetectionModel(Promise promise) {
        String modelName = "";
        if (keyWordsDetection != null) {
            modelName = keyWordsDetection.getKeywordDetectionModel();
        }
        promise.resolve(modelName);
        return modelName;
    }

    @ReactMethod
    public String getRecordingWav(Promise promise) {
        String wavFilePath = "";
        if (keyWordsDetection != null) {
            wavFilePath = keyWordsDetection.getRecordingWav ();
        }
        promise.resolve(wavFilePath);
        return wavFilePath;
    }

    @ReactMethod
    public Boolean setKeywordDetectionLicense(String licenseKey, Promise promise) {
        Boolean isLicesed = false;
        if (keyWordsDetection != null) {
            isLicesed = keyWordsDetection.setLicenseKey(licenseKey);
        }
        promise.resolve(isLicesed);
        return isLicesed;
    }

    @ReactMethod
    public void initKeywordDetection(String modelName, float threshold, int buffer_cnt, Promise promise) {
        Log.d(TAG, "initKeywordDetection(): ");
        try {
            keyThreshold = threshold;
            keyWordsDetection = new KeyWordsDetection(reactContext, modelName, threshold, buffer_cnt);
            Log.d(TAG, "initKeywordDetection(): Success - resolving promise");
            if (keyWordsDetection != null) {
                Log.d(TAG, "initKeywordDetection(): calling initialize(this::onKeywordDetected");
                keyWordsDetection.initialize(this::onKeywordDetected);
                Log.d(TAG, "initKeywordDetection(): Success - resolving promise");
                promise.resolve("KeyWordsDetection initialized with model: " + modelName);
            } else {
                Log.d(TAG, "initKeywordDetection(): Fail!!!!!!!!!!- resolving promise");
                promise.reject("init_error", "KeyWordsDetection is null");
            }
        } catch (Exception e) {
            Log.d(TAG, "initKeywordDetection(): Exception Fail!!!!!!!!!!- resolving promise");
            promise.reject("init_error", "Failed to initialize KeyWordsDetection", e);
        }
    }

    @ReactMethod
    public void startKeywordDetection() throws OrtException {
        if (keyWordsDetection != null) {
            try {
                keyWordsDetection.startListening(keyThreshold);
                keyWordsDetection.initialize(this::onKeywordDetected);
            }
            catch (Exception e) {
                Log.d(TAG, "ERROR startKeywordDetection(): Exception " + e);
            }
            return;
        } else {
            Log.d(TAG, "ERROR startKeywordDetection(): keyWordsDetection == null ");
            return;
        }
}

    @ReactMethod
    public void stopKeywordDetection() {
        if (keyWordsDetection != null) {
            keyWordsDetection.stopListening();
        } else {
            // Handle error
        }
    }

    // Stop detection for a specific instance
    @ReactMethod
    public void stopForegroundService(Promise promise) {
        if (keyWordsDetection != null) {
            keyWordsDetection.stopForegroundService();
            promise.resolve("stopForegroundService");
        } else {
            promise.reject("stopForegroundService", "No instance found with ID: ");
        }
    }
    
    // Stop detection for a specific instance
    @ReactMethod
    public void startForegroundService(String instanceId, Promise promise) {
        if (keyWordsDetection != null) {
            keyWordsDetection.startForegroundService();
            promise.resolve("startForegroundService" );
        } else {
            promise.reject("startForegroundService", "No instance found with ID: ");
        }
    }
    
    public static void callback() {
        //Log.d(TAG, "KeyWord detected! meanPrediction: " + meanPrediction);
        WritableMap params = Arguments.createMap();
        params.putString("phrase", "keyword");
        KeyWordRNBridge.sendEvent("onKeywordDetectionEvent", params);
    }

    public static void sendEvent(String eventName, @Nullable WritableMap params) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Set up any upstream listeners or background tasks as necessary
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Remove upstream listeners, stop unnecessary background tasks
    }
}
