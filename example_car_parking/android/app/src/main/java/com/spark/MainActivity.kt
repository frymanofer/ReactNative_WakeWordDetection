package com.spark

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.NonNull
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.annotation.RequiresApi
import android.os.PowerManager
import android.net.Uri
import android.provider.Settings
import com.davoice.keywordsdetection.keywordslibrary.MicrophoneService;

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    Log.d("MainActivity", "On create!!!!! check for cobraMainClass:() ")
    // The intent is automatically provided when the activity is launched
    if (intent != null && intent.hasCategory(Intent.CATEGORY_VOICE)) {
      // This means Google Assistant or another assistant service opened the app
      Log.d("MyApp", "App opened by Google Assistant")
  }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      requestDisableBatteryOptimization()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      requestMicrophonePermissions()
    }
    else {
      checkPermissions();
    }
  }
  // MainActivity.kt
  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun requestMicrophonePermissions() {
      val permissions = arrayOf(
          Manifest.permission.FOREGROUND_SERVICE,
          Manifest.permission.RECORD_AUDIO
      )
  
      val permissionsToRequest = permissions.filter {
          ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
      }.toTypedArray()
  
      if (permissionsToRequest.isNotEmpty()) {
          ActivityCompat.requestPermissions(this, permissionsToRequest, REQUEST_MICROPHONE_PERMISSIONS)
      } else {
          startForegroundService()
      }
  }
  
  private fun startForegroundService() {
    val serviceIntent = Intent(this, MicrophoneService::class.java)
    ContextCompat.startForegroundService(this, serviceIntent)
  }

  private fun checkPermissions() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
        ActivityCompat.requestPermissions(this, 
                arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MICROPHONE_PERMISSIONS)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                  ActivityCompat.requestPermissions(
                      this,
                      arrayOf(
                          Manifest.permission.FOREGROUND_SERVICE_MICROPHONE,
                          Manifest.permission.RECORD_AUDIO
                      ),
                      REQUEST_MICROPHONE_PERMISSIONS
                  )
              }
                      
    } else {
       startForegroundService()
    }
}

private val REQUEST_MICROPHONE_PERMISSIONS = 1
private fun startMicrophoneService() {
  if (ContextCompat.checkSelfPermission(this, Manifest.permission.FOREGROUND_SERVICE_MICROPHONE) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      val serviceIntent = Intent(this, MicrophoneService::class.java)
      ContextCompat.startForegroundService(this, serviceIntent)
  } else {
      requestMicrophonePermissions()
  }
}

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)

    if (requestCode == REQUEST_MICROPHONE_PERMISSIONS) {
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            startForegroundService()
        } else {
            Log.e("MainActivity", "Permissions denied")
            // Handle the case where the user denied the permissions.
        }
    }
  }

  @RequiresApi(Build.VERSION_CODES.M)
  private fun requestDisableBatteryOptimization() {
      val pm = getSystemService(POWER_SERVICE) as PowerManager
      val packageName = packageName
  
      // Check if the app is already whitelisted
      if (!pm.isIgnoringBatteryOptimizations(packageName)) {
          // Request the user to disable battery optimization
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          intent.data = Uri.parse("package:$packageName")
          startActivity(intent)
      }
  }
  
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Spark"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
