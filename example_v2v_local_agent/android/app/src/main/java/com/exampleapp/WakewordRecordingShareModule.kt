package com.exampleapp

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.util.ArrayList

class WakewordRecordingShareModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WakewordRecordingShare"

  @ReactMethod
  fun shareRecordings(paths: ReadableArray, title: String?, promise: Promise) {
    try {
      val context = reactApplicationContext
      val authority = "${context.packageName}.fileprovider"

      val uris = ArrayList<Uri>()
      for (i in 0 until paths.size()) {
        val path = paths.getString(i) ?: continue
        val file = File(path)
        if (!file.exists()) continue
        uris.add(FileProvider.getUriForFile(context, authority, file))
      }

      if (uris.isEmpty()) {
        promise.reject("NO_FILES", "No recording files were found to share.")
        return
      }

      val chooserTitle = title ?: "Share recordings"
      val mimeType = if (uris.size == 1) "audio/*" else "*/*"
      val sendIntent =
        if (uris.size == 1) {
          Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uris[0])
            putExtra(Intent.EXTRA_SUBJECT, chooserTitle)
            clipData = ClipData.newUri(context.contentResolver, chooserTitle, uris[0])
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
        } else {
          Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = mimeType
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            putExtra(Intent.EXTRA_SUBJECT, chooserTitle)
            clipData = ClipData.newUri(context.contentResolver, chooserTitle, uris[0]).apply {
              for (i in 1 until uris.size) {
                addItem(ClipData.Item(uris[i]))
              }
            }
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
        }

      val resolvedActivities = context.packageManager.queryIntentActivities(
        sendIntent,
        PackageManager.MATCH_DEFAULT_ONLY,
      )
      for (resolveInfo in resolvedActivities) {
        val packageName = resolveInfo.activityInfo?.packageName ?: continue
        for (uri in uris) {
          context.grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      }

      val chooserIntent = Intent.createChooser(sendIntent, chooserTitle)
      val activity = getCurrentActivity()
      if (activity != null) {
        activity.startActivity(chooserIntent)
      } else {
        chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooserIntent)
      }

      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("SHARE_FAILED", t.message, t)
    }
  }
}
