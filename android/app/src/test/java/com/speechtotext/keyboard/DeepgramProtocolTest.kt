package com.speechtotext.keyboard

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DeepgramProtocolTest {
    @Test fun `Flux uses raw PCM matching the microphone format`() {
        val url = DeepgramProtocol.url(SttEngine.FLUX)
        assertTrue(url.startsWith("wss://api.deepgram.com/v2/listen?"))
        assertTrue(url.contains("encoding=linear16"))
        assertTrue(url.contains("sample_rate=16000"))
        assertEquals(2560, DeepgramProtocol.CHUNK_BYTES)
        assertFalse("Flux v2 rejects channels query parameter with HTTP 400", url.contains("channels="))
        assertFalse(url.contains("smart_format"))
        assertEquals("""{"type":"ForceEndTurn"}""", DeepgramProtocol.flushMessage(SttEngine.FLUX))
    }

    @Test fun `Nova enables dictation and interim results`() {
        val url = DeepgramProtocol.url(SttEngine.NOVA)
        assertTrue(url.contains("/v1/listen?"))
        assertTrue(url.contains("channels=1"))
        assertTrue(url.contains("interim_results=true"))
        assertTrue(url.contains("dictation=true"))
        assertEquals("""{"type":"Finalize"}""", DeepgramProtocol.flushMessage(SttEngine.NOVA))
    }

    @Test fun `Flux updates remain composing until end of turn`() {
        val update = JSONObject("""{"type":"TurnInfo","event":"Update","transcript":"hello"}""")
        assertEquals(TranscriptEvent("hello", false), DeepgramProtocol.transcript(SttEngine.FLUX, update))
        update.put("event", "EndOfTurn")
        assertEquals(TranscriptEvent("hello", true), DeepgramProtocol.transcript(SttEngine.FLUX, update))
        assertFalse(DeepgramProtocol.flushed(SttEngine.FLUX, update))
        update.put("trigger", "manual")
        assertTrue(DeepgramProtocol.flushed(SttEngine.FLUX, update))
    }

    @Test fun `Nova extracts only the best transcript and preserves final flag`() {
        val message = JSONObject("""{"type":"Results","is_final":true,"channel":{"alternatives":[{"transcript":"Hello."}]}}""")
        assertEquals(TranscriptEvent("Hello.", true), DeepgramProtocol.transcript(SttEngine.NOVA, message))
        assertNull(DeepgramProtocol.transcript(SttEngine.FLUX, message))
    }

    @Test fun `empty results and non transcript events do not insert text`() {
        assertNull(DeepgramProtocol.transcript(SttEngine.NOVA, JSONObject("""{"type":"Results","channel":{"alternatives":[]}}""")))
        assertNull(DeepgramProtocol.transcript(SttEngine.FLUX, JSONObject("""{"type":"TurnInfo","event":"StartOfTurn"}""")))
    }

    @Test fun `authentication failures are actionable without exposing credentials`() {
        assertTrue(DeepgramProtocol.connectionError(401).contains("key"))
        assertTrue(DeepgramProtocol.connectionError(402).contains("credit"))
    }
}
