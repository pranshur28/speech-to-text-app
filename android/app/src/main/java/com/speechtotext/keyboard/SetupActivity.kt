package com.speechtotext.keyboard

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.os.Build
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.widget.*

class SetupActivity : Activity() {
    private lateinit var settings: KeyboardSettings
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        settings = KeyboardSettings(this)
        val scroll = ScrollView(this)
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(32))
        }
        scroll.addView(body)
        scroll.setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                if (insets.isVisible(WindowInsets.Type.ime())) {
                    view.post {
                        val focused = scroll.findFocus()
                        if (focused is EditText) {
                            val rectangle = android.graphics.Rect()
                            focused.getFocusedRect(rectangle)
                            focused.requestRectangleOnScreen(rectangle, true)
                        }
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        fun text(value: String, size: Float = 16f): TextView = TextView(this).apply {
            text = value; textSize = size; setTextColor(Color.rgb(230, 232, 240))
            setPadding(0, dp(8), 0, dp(8)); body.addView(this)
        }
        fun button(label: String, action: () -> Unit) {
            body.addView(Button(this).apply { text = label; isAllCaps = false; setOnClickListener { action() } })
        }

        text("Speech Keyboard", 28f)
        text("Type when you want. Speak when it suits you.")
        status = text("")
        text("1. Set up dictation", 20f)
        text("Your microphone audio is sent directly to Deepgram only while you record. " +
            "This version does not save transcripts or sync with your desktop. Ordinary typing stays on your device.")
        val key = EditText(this).apply {
            hint = "Enter or replace your Deepgram API key"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            setSingleLine(true)
        }
        body.addView(key)
        button("Save API key") {
            try {
                settings.saveApiKey(key.text.toString())
                key.text.clear()
                refreshStatus()
                Toast.makeText(this, "API key saved on this device", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(this, "Could not save key. Enter a key and try again.", Toast.LENGTH_LONG).show()
            }
        }
        button("Remove saved API key") { settings.clearApiKey(); refreshStatus() }
        text("Recognition model")
        val models = Spinner(this).apply {
            adapter = ArrayAdapter(this@SetupActivity, android.R.layout.simple_spinner_dropdown_item,
                listOf("Flux — conversational phrases", "Nova-3 — punctuation and formatting"))
            setSelection(if (settings.engine == SttEngine.FLUX) 0 else 1)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    settings.engine = if (position == 0) SttEngine.FLUX else SttEngine.NOVA
                }
                override fun onNothingSelected(parent: AdapterView<*>?) { }
            }
        }
        body.addView(models)
        button("Allow microphone") { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1) }
        text("2. Enable and select the keyboard", 20f)
        text("Android will show its standard keyboard warning. Enable Speech Keyboard, then select it. " +
            "Use the globe key to return to your other keyboard at any time.")
        button("Enable keyboard in Android settings") { startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) }
        button("Choose keyboard") { getSystemService(InputMethodManager::class.java).showInputMethodPicker() }
        text("3. Try typing or tap Mic", 20f)
        text("Your saved API key stays on this phone when you install an update over the existing app. " +
            "You do not need a new Deepgram key for each version. Uninstalling or clearing app data removes the saved copy.")
        text("Keyboard feel", 20f)
        body.addView(Switch(this).apply {
            text = "Haptic feedback (uses your phone's touch-vibration setting)"
            isChecked = settings.haptics
            setOnCheckedChangeListener { _, enabled -> settings.haptics = enabled }
        })
        body.addView(Switch(this).apply {
            text = "Show character preview when pressing a key"
            isChecked = settings.previews
            setOnCheckedChangeListener { _, enabled -> settings.previews = enabled }
        })
        text("Split layout")
        body.addView(Spinner(this).apply {
            adapter = ArrayAdapter(this@SetupActivity, android.R.layout.simple_spinner_dropdown_item,
                listOf("Automatic — wide or landscape screens", "Always split on wide screens", "Never split"))
            val values = listOf("auto", "on", "off")
            setSelection(values.indexOf(settings.splitLayout).coerceAtLeast(0))
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    settings.splitLayout = values[position]
                }
                override fun onNothingSelected(parent: AdapterView<*>?) { }
            }
        })
        body.addView(EditText(this).apply {
            hint = "Try a message, an email address, or a website…"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 3
            gravity = android.view.Gravity.TOP
        })
        text("Tap Shift once for a capital; double-tap for Caps Lock. Hold Backspace to repeat. " +
            "Use ?123 → #+= → Math for punctuation, currency and math. Hold letters for their small corner symbols; " +
            "tap ☺ for emoji and hold an emoji for variants. Dictation stops when the keyboard hides, " +
            "you move the cursor, change fields, or start typing. Mic is disabled in password fields.")
        setContentView(scroll)
    }

    override fun onResume() { super.onResume(); if (::status.isInitialized) refreshStatus() }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshStatus()
    }

    private fun refreshStatus() {
        val mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        status.text = getString(R.string.setup_status,
            getString(if (settings.hasApiKey()) R.string.saved else R.string.not_set),
            getString(if (mic) R.string.allowed else R.string.not_allowed))
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
