package com.speechtotext.keyboard

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** The provider key is encrypted at rest; never put it in source, logs, or backups. */
class KeyboardSettings(context: Context) {
    private val prefs = context.getSharedPreferences("keyboard", Context.MODE_PRIVATE)

    var haptics: Boolean
        get() = prefs.getBoolean("haptics", true)
        set(value) { prefs.edit().putBoolean("haptics", value).apply() }
    var previews: Boolean
        get() = prefs.getBoolean("previews", true)
        set(value) { prefs.edit().putBoolean("previews", value).apply() }
    var suggestions: Boolean
        get() = prefs.getBoolean("suggestions", true)
        set(value) { prefs.edit().putBoolean("suggestions", value).apply() }
    var splitLayout: String
        get() = prefs.getString("split_layout", "auto") ?: "auto"
        set(value) { prefs.edit().putString("split_layout", value).apply() }

    var engine: SttEngine
        get() = if (prefs.getString("engine", "flux") == "nova-3") SttEngine.NOVA else SttEngine.FLUX
        set(value) { prefs.edit().putString("engine", value.id).apply() }

    fun hasApiKey() = !prefs.getString("api_key", null).isNullOrEmpty()

    fun readApiKey(): String {
        val stored = prefs.getString("api_key", null) ?: return ""
        val parts = stored.split(":")
        require(parts.size == 2) { "Saved key could not be read. Save it again in Settings." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        return String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
    }

    fun saveApiKey(value: String) {
        require(value.isNotBlank()) { "Enter your Deepgram API key." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encoded = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
            Base64.encodeToString(cipher.doFinal(value.trim().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
        check(prefs.edit().putString("api_key", encoded).commit()) { "Could not save the API key." }
    }

    fun clearApiKey() { prefs.edit().remove("api_key").apply() }

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }

    companion object { private const val KEY_ALIAS = "speech_keyboard_provider_key" }
}
