package com.exampleapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Match RN 0.82 template: apply theme before super
    setTheme(R.style.AppTheme)
    // Pass null to avoid fragment restore issues
    super.onCreate(null)

    Log.d("MainActivity", "onCreate — checking voice intent & permissions")

    // If launched by a voice assistant (optional)
    intent?.let { i ->
      if (i.hasCategory(Intent.CATEGORY_VOICE)) {
        Log.d("MainActivity", "App opened by a voice assistant")
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      requestDisableBatteryOptimization()
    }

    // Only RECORD_AUDIO is a runtime permission
    ensureRecordAudioPermission()
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
  }

  private fun ensureRecordAudioPermission() {
    val perm = Manifest.permission.RECORD_AUDIO
    val granted = ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED
    if (!granted) {
      ActivityCompat.requestPermissions(this, arrayOf(perm), REQUEST_MIC_PERMISSION)
    } else {
      onMicrophoneReady()
    }
  }

  // If you actually run a foreground service for mic, start it here.
  private fun onMicrophoneReady() {
    Log.d("MainActivity", "Microphone permission granted")
    // startForegroundServiceIfNeeded()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_MIC_PERMISSION) {
      val ok = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
      if (ok) {
        onMicrophoneReady()
      } else {
        Log.e("MainActivity", "RECORD_AUDIO permission denied")
      }
    }
  }

  @RequiresApi(Build.VERSION_CODES.M)
  private fun requestDisableBatteryOptimization() {
    val pm = getSystemService(POWER_SERVICE) as PowerManager
    val pkg = packageName
    if (!pm.isIgnoringBatteryOptimizations(pkg)) {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:$pkg")
      }
      // This shows a system dialog; keep it only if your app truly needs it.
      startActivity(intent)
    }
  }

  override fun getMainComponentName(): String = "ExampleApp"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    private const val REQUEST_MIC_PERMISSION = 1001
  }
}
