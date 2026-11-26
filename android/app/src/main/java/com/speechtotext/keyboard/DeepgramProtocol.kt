package com.speechtotext.keyboard

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject

enum class SttEngine(val id: String) { FLUX("flux"), NOVA("nova-3") }

data class TranscriptEvent(val text: String, val final: Boolean)

object DeepgramProtocol {
    const val SAMPLE_RATE = 16000
    const val CHUNK_BYTES = SAMPLE_RATE * 2 * 80 / 1000 // mono 16-bit PCM, 80 ms

    fun url(engine: SttEngine): String {
        val path = if (engine == SttEngine.FLUX) "v2" else "v1"
        val builder = "https://api.deepgram.com/$path/listen".toHttpUrl().newBuilder()
            .addQueryParameter("model", if (engine == SttEngine.FLUX) "flux-general-en" else "nova-3")
            .addQueryParameter("encoding", "linear16")
            .addQueryParameter("sample_rate", SAMPLE_RATE.toString())
            .addQueryParameter("channels", "1")
        if (engine == SttEngine.NOVA) {
            builder.addQueryParameter("punctuate", "true")
                .addQueryParameter("smart_format", "true")
                .addQueryParameter("dictation", "true")
                .addQueryParameter("interim_results", "true")
                .addQueryParameter("endpointing", "300")
        }
        return builder.build().toString().replaceFirst("https:", "wss:")
    }

    fun transcript(engine: SttEngine, message: JSONObject): TranscriptEvent? {
        if (engine == SttEngine.FLUX) {
            if (message.optString("type") != "TurnInfo") return null
            val event = message.optString("event")
            if (event !in setOf("Update", "TurnResumed", "EndOfTurn")) return null
            val text = message.optString("transcript").trim()
            return if (text.isNotEmpty()) TranscriptEvent(text, event == "EndOfTurn") else null
        }
        if (message.optString("type") != "Results") return null
        val text = message.optJSONObject("channel")?.optJSONArray("alternatives")
            ?.optJSONObject(0)?.optString("transcript")?.trim().orEmpty()
        return if (text.isNotEmpty()) TranscriptEvent(text, message.optBoolean("is_final")) else null
    }

    fun flushed(engine: SttEngine, message: JSONObject): Boolean =
        if (engine == SttEngine.FLUX) message.optString("event") == "EndOfTurn" && message.optString("trigger") == "manual"
        else message.optBoolean("from_finalize") || message.optString("type") == "Metadata"

    fun connectionError(status: Int?): String = when (status) {
        401, 403 -> "Deepgram rejected the key. Check Settings."
        402 -> "Your Deepgram account is out of credit."
        400 -> "Deepgram rejected the audio request. Try the other model in Settings."
        else -> "Connection lost. Check your internet connection, then tap Mic to retry."
    }
}
