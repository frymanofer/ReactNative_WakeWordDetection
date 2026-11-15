package com.exampleapp

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.OpenableColumns
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import kotlin.math.abs

/**
 * The voice sample for voice cloning (Speech.createVoiceClone).
 * JS: NativeModules.VoiceRecorder.
 *
 * Records the microphone to a 16-bit mono WAV file:
 * start(path) -> path; status() -> {recording, seconds, peak 0..1};
 * stop() -> {path, seconds}; cancel() deletes the file.
 * The app pauses the wake word microphone first.
 *
 * pickAudioFile() -> {path, name} (a copy in the app's cache) or null when the
 * user cancels: the system file picker, audio files only.
 */
class VoiceRecorderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "VoiceRecorder"

  // The microphone hardware's native rate; the TTS library resamples the WAV
  // to the model rate itself (windowed sinc).
  private val sampleRate = 48000
  @Volatile private var recording = false
  @Volatile private var dataBytes = 0L
  @Volatile private var peak = 0f
  private var thread: Thread? = null
  private var record: AudioRecord? = null
  private var file: File? = null
  private var pickPromise: Promise? = null

  private val activityListener = object : ActivityEventListener {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != PICK_AUDIO_REQUEST) return
      val promise = pickPromise ?: return
      pickPromise = null
      val uri = data?.data
      if (resultCode != Activity.RESULT_OK || uri == null) {
        promise.resolve(null)
        return
      }
      Thread {
        try {
          promise.resolve(copyToCache(uri))
        } catch (t: Throwable) {
          promise.reject("PICK_FAILED", t.message ?: "The file could not be read.", t)
        }
      }.start()
    }

    override fun onNewIntent(intent: Intent) {}
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  @ReactMethod
  fun pickAudioFile(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "The app is not in the foreground.")
      return
    }
    if (pickPromise != null) {
      promise.reject("BUSY", "The file picker is already open.")
      return
    }
    pickPromise = promise
    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
        .addCategory(Intent.CATEGORY_OPENABLE)
        .setType("audio/*")
      activity.startActivityForResult(intent, PICK_AUDIO_REQUEST)
    } catch (t: Throwable) {
      pickPromise = null
      promise.reject("PICK_FAILED", t.message ?: "The file picker could not be opened.", t)
    }
  }

  private fun copyToCache(uri: Uri): com.facebook.react.bridge.WritableMap {
    val resolver = reactApplicationContext.contentResolver
    var name = "voice_sample"
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0)
    }
    val safeName = name.replace(Regex("[^A-Za-z0-9._ -]"), "_")
    val folder = File(reactApplicationContext.cacheDir, "voice_clone_upload").apply {
      deleteRecursively()
      mkdirs()
    }
    val out = File(folder, safeName)
    resolver.openInputStream(uri)?.use { input ->
      FileOutputStream(out).use { output -> input.copyTo(output) }
    } ?: throw IllegalStateException("The file could not be opened.")
    val map = Arguments.createMap()
    map.putString("path", out.absolutePath)
    map.putString("name", name)
    return map
  }

  @ReactMethod
  fun start(path: String, promise: Promise) {
    if (recording) {
      promise.reject("BUSY", "Already recording.")
      return
    }
    if (ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.RECORD_AUDIO)
      != PackageManager.PERMISSION_GRANTED) {
      promise.reject("NO_PERMISSION", "Microphone permission is not granted.")
      return
    }
    try {
      val minBuffer = AudioRecord.getMinBufferSize(
        sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      val bufferSize = maxOf(minBuffer, sampleRate / 5 * 2)  // >= 200 ms
      val rec = AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION, sampleRate,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize)
      if (rec.state != AudioRecord.STATE_INITIALIZED) {
        rec.release()
        promise.reject("MIC_UNAVAILABLE", "The microphone could not be opened.")
        return
      }
      val out = File(path.removePrefix("file://"))
      out.parentFile?.mkdirs()
      val stream = FileOutputStream(out)
      stream.write(ByteArray(44))  // header, written on stop
      record = rec
      file = out
      dataBytes = 0
      peak = 0f
      recording = true
      rec.startRecording()
      thread = Thread {
        val buffer = ShortArray(bufferSize / 2)
        val bytes = ByteArray(buffer.size * 2)
        try {
          while (recording) {
            val n = rec.read(buffer, 0, buffer.size)
            if (n <= 0) continue
            var max = 0
            for (i in 0 until n) {
              val s = buffer[i].toInt()
              max = maxOf(max, abs(s))
              bytes[2 * i] = (s and 0xff).toByte()
              bytes[2 * i + 1] = ((s shr 8) and 0xff).toByte()
            }
            peak = max / 32768f
            stream.write(bytes, 0, n * 2)
            dataBytes += n * 2
          }
        } finally {
          stream.close()
        }
      }.also { it.start() }
      promise.resolve(out.absolutePath)
    } catch (t: Throwable) {
      recording = false
      promise.reject("RECORD_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun status(promise: Promise) {
    val map = Arguments.createMap()
    map.putBoolean("recording", recording)
    map.putDouble("seconds", dataBytes / 2.0 / sampleRate)
    map.putDouble("peak", peak.toDouble())
    promise.resolve(map)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    val out = file
    if (out == null) {
      promise.reject("NOT_RECORDING", "Nothing is being recorded.")
      return
    }
    try {
      finish()
      writeHeader(out, dataBytes)
      val map = Arguments.createMap()
      map.putString("path", out.absolutePath)
      map.putDouble("seconds", dataBytes / 2.0 / sampleRate)
      promise.resolve(map)
    } catch (t: Throwable) {
      promise.reject("RECORD_FAILED", t.message, t)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    val out = file
    try { finish() } catch (_: Throwable) {}
    out?.delete()
    promise.resolve(null)
  }

  private fun finish() {
    recording = false
    try { record?.stop() } catch (_: Throwable) {}
    thread?.join(2000)
    record?.release()
    record = null
    thread = null
    file = null
  }

  private fun writeHeader(out: File, data: Long) {
    RandomAccessFile(out, "rw").use { f ->
      fun int(v: Long) = byteArrayOf(v.toByte(), (v shr 8).toByte(), (v shr 16).toByte(), (v shr 24).toByte())
      fun short(v: Int) = byteArrayOf(v.toByte(), (v shr 8).toByte())
      f.seek(0)
      f.write("RIFF".toByteArray()); f.write(int(36 + data)); f.write("WAVE".toByteArray())
      f.write("fmt ".toByteArray()); f.write(int(16)); f.write(short(1)); f.write(short(1))
      f.write(int(sampleRate.toLong())); f.write(int(sampleRate * 2L)); f.write(short(2)); f.write(short(16))
      f.write("data".toByteArray()); f.write(int(data))
    }
  }

  override fun invalidate() {
    try { finish() } catch (_: Throwable) {}
    reactApplicationContext.removeActivityEventListener(activityListener)
    super.invalidate()
  }

  private companion object {
    const val PICK_AUDIO_REQUEST = 47211
  }
}
