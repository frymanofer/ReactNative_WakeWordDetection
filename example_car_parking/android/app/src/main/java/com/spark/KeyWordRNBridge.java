package com.spark.keywordspotting;

import com.davoice.keywordsdetection.keywordslibrary.KeyWordsDetection;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import androidx.annotation.Nullable;
import ai.onnxruntime.*;
import android.util.Log;
import java.util.HashMap;
import java.util.Map;

public class KeyWordRNBridge extends ReactContextBaseJavaModule {

    private final String TAG = "KeyWordsDetection";
    private static final String REACT_CLASS = "KeyWordRNBridge";
    private static ReactApplicationContext reactContext;

    // Map to hold multiple instances
    private Map<String, KeyWordsDetection> instances = new HashMap<>();

    public KeyWordRNBridge(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @ReactMethod
    public Boolean setKeywordDetectionLicense(String instanceId, String licenseKey, Promise promise) {
        KeyWordsDetection instance = instances.get(instanceId);
        Log.d(TAG, "setKeywordDetectionLicense()");

        Boolean isLicesed = false;
        if (instance != null) {
            isLicesed = instance.setLicenseKey(licenseKey);
        }
        Log.d(TAG, "setKeywordDetectionLicense(): " + (isLicesed ? "Licensed" : "Not Licensed"));

        promise.resolve(isLicesed);
        return isLicesed;
    }

    // Create a new instance
    @ReactMethod
    public void createInstance(String instanceId, String modelName, float threshold, int bufferCnt, Promise promise) {
        if (instances.containsKey(instanceId)) {
            promise.reject("InstanceExists", "Instance already exists with ID: " + instanceId);
            return;
        }

        try {
            KeyWordsDetection keyWordsDetection = new KeyWordsDetection(reactContext, modelName, threshold, bufferCnt);
            keyWordsDetection.initialize(detected -> onKeywordDetected(instanceId, detected));
            instances.put(instanceId, keyWordsDetection);
            promise.resolve("Instance created with ID: " + instanceId);
        } catch (Exception e) {
            promise.reject("CreateError", "Failed to create instance: " + e.getMessage());
        }
    }

    // Create a new instance
    @ReactMethod
    public void replaceKeywordDetectionModel(String instanceId, String modelName, float threshold, int bufferCnt, Promise promise) {
        KeyWordsDetection instance = instances.get(instanceId);
        if (instance == null) {
            promise.reject("Instance not Exists", "Instance does not exists with ID: " + instanceId);
            return;
        }

        try {
            instance.replaceKeywordDetectionModel(reactContext, modelName, threshold, bufferCnt);
            promise.resolve("Instance ID: " + instanceId + " change model " + modelName);
        } catch (Exception e) {
            promise.reject("CreateError", "Failed to create instance: " + e.getMessage());
        }
    }

    // Start detection for a specific instance
    @ReactMethod
    public void startKeywordDetection(String instanceId, float threshold, Promise promise) throws OrtException {
        KeyWordsDetection instance = instances.get(instanceId);
        if (instance != null) {
            instance.startListening(threshold);
            promise.resolve("Started detection for instance: " + instanceId);
        } else {
            promise.reject("InstanceNotFound", "No instance found with ID: " + instanceId);
        }
    }

    // Stop detection for a specific instance
    @ReactMethod
    public void stopKeywordDetection(String instanceId, Promise promise) {
        KeyWordsDetection instance = instances.get(instanceId);
        if (instance != null) {
            instance.stopListening();
            promise.resolve("Stopped detection for instance: " + instanceId);
        } else {
            promise.reject("InstanceNotFound", "No instance found with ID: " + instanceId);
        }
    }

    // Destroy an instance
    @ReactMethod
    public void destroyInstance(String instanceId, Promise promise) {
        KeyWordsDetection instance = instances.remove(instanceId);
        if (instance != null) {
            instance.stopListening();
            // Additional cleanup if necessary
            promise.resolve("Destroyed instance: " + instanceId);
        } else {
            promise.reject("InstanceNotFound", "No instance found with ID: " + instanceId);
        }
    }

    // Handle keyword detection event
    private void onKeywordDetected(String instanceId, Boolean detected) {
        if (detected) {
            WritableMap params = Arguments.createMap();
            params.putString("instanceId", instanceId);
            params.putString("phrase", "keyword");
            sendEvent("onKeywordDetectionEvent", params);
        }
    }

    // Send event to JavaScript
    private void sendEvent(String eventName, @Nullable WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
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
    // Implement other methods as needed, ensuring to use instanceId
}
