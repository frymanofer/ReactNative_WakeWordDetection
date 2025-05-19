package com.exampleapp

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.davoice.keywordsdetection.keywordslibrary.MicrophoneService;

@ReactModule(name = "ForegroundServiceModule")
class ForegroundServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ForegroundServiceModule"
    }

    @ReactMethod
    fun startService() {
        val context = reactApplicationContext
        val serviceIntent = Intent(context, MicrophoneService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }

    @ReactMethod
    fun stopService() {
        val context = reactApplicationContext
        val serviceIntent = Intent(context, MicrophoneService::class.java)
        context.stopService(serviceIntent)
    }
}
