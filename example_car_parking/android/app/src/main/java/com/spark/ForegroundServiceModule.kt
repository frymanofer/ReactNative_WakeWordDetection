package com.spark

import android.content.Intent
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.davoice.keywordsdetection.keywordslibrary.MicrophoneService;
import com.facebook.react.bridge.Promise
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat

@ReactModule(name = "ForegroundServiceModule")
class ForegroundServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val context: ReactApplicationContext = reactContext

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

    @ReactMethod
    fun startAudioForegroundService() {
        val serviceIntent = Intent(context, MicrophoneService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
        
        showForegroundNotification(context)
    }

    @ReactMethod
    fun bringAppToForeground(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("Activity is null")
            return
        }
    
        try {
        /*

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    
            if (launchIntent != null) {
                //launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                launchIntent.flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED

                context.startActivity(launchIntent)
            }
            else 
                promise.reject("Error", "Kaki")

            // Another way to do this!
            //val intent = Intent(context, SplashScreen::class.java)

            // Alternatively, use package manager if needed:
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)

            intent?.let {
                it.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)

                it.action = Intent.ACTION_MAIN
                it.addCategory(Intent.CATEGORY_LAUNCHER)
                context.startActivity(it)
            } ?: run {
                // Handle the case where the intent is null (package not found or other issue)
                promise.reject("Error", "e")
            }
               //         


            // Intent to bring the app to the foreground
            val intent = Intent(context, activity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            context.startActivity(intent)*/
            showForegroundNotification(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    fun showForegroundNotification(context: Context) {
        val channelId = "audio_playback_channel_id"
        val channelName = "Audio Playback Channel"
    
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    
        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_LOW)
            notificationManager.createNotificationChannel(channel)
        }
    
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    
        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle("Spark Audio Playback")
            .setContentText("Audio is playing in the background")
            .setSmallIcon(R.drawable.ic_launcher) // Replace with your app's icon
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
    
        notificationManager.notify(1, notification)
    }
/*     
    fun showForegroundNotification(context: Context) {
        val channelId = "foreground_channel_id"
        val channelName = "Foreground Channel"

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH)
            notificationManager.createNotificationChannel(channel)
        }

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle("App Name")
            .setContentText("Tap to return to the app")
            .setSmallIcon(R.drawable.ic_launcher) // Replace with your app's icon
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(1, notification)
    }
    */
}
