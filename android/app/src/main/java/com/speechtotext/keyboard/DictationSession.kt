package com.speechtotext.keyboard

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString.Companion.toByteString
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** One microphone/socket lifetime. No retry or recording outside the visible keyboard. */
class DictationSession(
    private val apiKey: String,
    private val engine: SttEngine,
    private val listener: Listener,
) {
    interface Listener {
        fun onListening()
        fun onTranscript(event: TranscriptEvent)
        fun onFinished(error: String?)
    }

    private val main = Handler(Looper.getMainLooper())
    private val finished = AtomicBoolean(false)
    private val stopping = AtomicBoolean(false)
    private val capturing = AtomicBoolean(false)
    private val audioExecutor = Executors.newSingleThreadExecutor()
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var socket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .pingInterval(10, TimeUnit.SECONDS)
        .build()
    private val stopTimeout = Runnable { finish(null) }
    private val connectTimeout = Runnable { finish("Connection timed out. Check your internet connection.") }

    fun start() {
        main.postDelayed(connectTimeout, 10000)
        val request = Request.Builder().url(DeepgramProtocol.url(engine))
            .header("Authorization", "Token $apiKey").build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                main.removeCallbacks(connectTimeout)
                if (finished.get() || stopping.get()) { webSocket.cancel(); return }
                try { audioExecutor.execute { capture(webSocket) } }
                catch (_: java.util.concurrent.RejectedExecutionException) { webSocket.cancel() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (finished.get()) return
                val message = try { JSONObject(text) } catch (_: Exception) {
                    finish("Unexpected transcription response. Tap Mic to try again.")
                    return
                }
                if (message.optString("type") == "Error") {
                    finish("Deepgram could not transcribe this session. Check your key and selected model.")
                    return
                }
                DeepgramProtocol.transcript(engine, message)?.let { event ->
                    main.post { if (!finished.get()) listener.onTranscript(event) }
                }
                if (stopping.get() && DeepgramProtocol.flushed(engine, message)) {
                    // Keep transcript callbacks ordered ahead of the completion callback.
                    main.post { finish(null) }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                finish(DeepgramProtocol.connectionError(response?.code))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                finish(if (stopping.get()) null else "Connection closed. Tap Mic to retry.")
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, null)
            }
        })
    }

    /** Stop the microphone now, then wait briefly for the server's last transcript. */
    fun stop() {
        if (finished.get() || !stopping.compareAndSet(false, true)) return
        capturing.set(false)
        // AudioRecord.read is bounded to one 80ms frame; the audio thread flushes after it.
        main.postDelayed(stopTimeout, 2500)
    }

    /** Abandon this session on field changes/hide; late callbacks must not edit a new field. */
    fun cancel() { finish(null, notify = false) }

    @SuppressLint("MissingPermission") // Permission checked by the IME immediately before start.
    private fun capture(webSocket: WebSocket) {
        var audio: AudioRecord? = null
        try {
            if (finished.get() || stopping.get()) { finish(null); return }
            val minimum = AudioRecord.getMinBufferSize(DeepgramProtocol.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            check(minimum > 0) { "Unsupported microphone format" }
            audio = AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                .setAudioFormat(AudioFormat.Builder().setSampleRate(DeepgramProtocol.SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setBufferSizeInBytes(maxOf(minimum, DeepgramProtocol.CHUNK_BYTES * 4)).build()
            recorder = audio
            check(audio.state == AudioRecord.STATE_INITIALIZED)
            if (finished.get() || stopping.get()) return
            audio.startRecording()
            capturing.set(true)
            if (finished.get() || stopping.get()) capturing.set(false)
            main.post { if (!finished.get() && !stopping.get()) listener.onListening() }
            val frame = ByteArray(DeepgramProtocol.CHUNK_BYTES)
            while (capturing.get() && !finished.get()) {
                val count = audio.read(frame, 0, frame.size, AudioRecord.READ_BLOCKING)
                if (finished.get()) break
                if (count < 0) error("Audio capture failed")
                if (count == 0) continue
                // Bound queued audio rather than accumulating indefinitely on a poor connection.
                if (webSocket.queueSize() > 16000L * 2 * 3 || !webSocket.send(frame.toByteString(0, count))) {
                    finish("Connection is too slow. Recording stopped; tap Mic to retry.")
                    break
                }
            }
        } catch (_: SecurityException) {
            finish("Allow microphone access in Speech Keyboard settings.")
        } catch (_: Exception) {
            if (!finished.get()) finish("Could not record audio. Check microphone access and try again.")
        } finally {
            try { if (audio?.recordingState == AudioRecord.RECORDSTATE_RECORDING) audio.stop() } catch (_: Exception) { }
            audio?.release()
            recorder = null
            if (stopping.get() && !finished.get()) {
                if (!webSocket.send(DeepgramProtocol.flushMessage(engine))) finish(null)
            }
        }
    }

    private fun finish(error: String?, notify: Boolean = true) {
        if (!finished.compareAndSet(false, true)) return
        capturing.set(false)
        main.removeCallbacks(stopTimeout)
        main.removeCallbacks(connectTimeout)
        socket?.cancel()
        audioExecutor.shutdown()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        if (notify) main.post { listener.onFinished(error) }
    }
}
