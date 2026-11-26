package com.speechtotext.keyboard

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.widget.*

class SetupActivity : Activity() {
    private lateinit var settings: KeyboardSettings
    private lateinit var apiKeyPill: TextView
    private lateinit var micPill: TextView
    private lateinit var enabledPill: TextView
    private lateinit var activePill: TextView
    private lateinit var dictionarySummary: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 30) {
            @Suppress("DEPRECATION")
            window.setDecorFitsSystemWindows(false)
        }
        settings = KeyboardSettings(this)

        val scroll = ScrollView(this).apply {
            setBackgroundColor(COLOR_BG)
            isFillViewport = true
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(36))
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
                view.setPadding(
                    insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom,
                )
            }
            insets
        }

        // Header
        body.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 26f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setTextColor(COLOR_TEXT_PRIMARY)
            setPadding(dp(2), dp(4), dp(2), dp(2))
        })
        body.addView(TextView(this).apply {
            text = "Matte Graphite keyboard with real-time Deepgram dictation"
            textSize = 13.5f
            setTextColor(COLOR_TEXT_MUTED)
            setPadding(dp(2), 0, dp(2), dp(14))
        })

        // Status Overview Card
        val statusCard = card(body, "Setup status")
        val row1 = horizontalRow(statusCard, bottomMarginDp = 8)
        apiKeyPill = statusBadge().also { row1.addView(it, equalWeight(endMarginDp = 8)) }
        micPill = statusBadge().also { row1.addView(it, equalWeight()) }
        val row2 = horizontalRow(statusCard)
        enabledPill = statusBadge().also { row2.addView(it, equalWeight(endMarginDp = 8)) }
        activePill = statusBadge().also { row2.addView(it, equalWeight()) }

        // Card 1: Dictation & Deepgram
        val dictationCard = card(body, "Dictation & Deepgram")
        helperText(
            dictationCard,
            "Audio streams directly to Deepgram only while Mic is active. Your API key is encrypted on-device with Android Keystore and kept across app updates.",
        )
        val keyInput = styledInput("Enter or replace Deepgram API key", password = true)
        dictationCard.addView(keyInput, fullWidth(topMarginDp = 10, bottomMarginDp = 10))

        val keyActions = horizontalRow(dictationCard, bottomMarginDp = 14)
        keyActions.addView(
            pillButton("Save API key", ButtonKind.PRIMARY) {
                try {
                    settings.saveApiKey(keyInput.text.toString())
                    keyInput.text.clear()
                    refreshStatus()
                    Toast.makeText(this, "API key saved on this device", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    Toast.makeText(this, "Enter a valid API key and try again.", Toast.LENGTH_LONG).show()
                }
            },
            equalWeight(endMarginDp = 8),
        )
        keyActions.addView(
            pillButton("Remove key", ButtonKind.DANGER) {
                settings.clearApiKey()
                refreshStatus()
                Toast.makeText(this, "Saved API key removed", Toast.LENGTH_SHORT).show()
            },
            equalWeight(),
        )

        fieldLabel(dictationCard, "Recognition model")
        val modelSpinner = styledSpinner(
            listOf("Flux — conversational sentences & punctuation", "Nova-3 — numbers, dates & spoken punctuation"),
            if (settings.engine == SttEngine.FLUX) 0 else 1,
        ) { position ->
            settings.engine = if (position == 0) SttEngine.FLUX else SttEngine.NOVA
        }
        dictationCard.addView(modelSpinner, fullWidth(topMarginDp = 6, bottomMarginDp = 12))
        dictationCard.addView(
            pillButton("Allow microphone access", ButtonKind.SECONDARY) {
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
            },
            fullWidth(),
        )

        // Card 2: Keyboard Setup
        val keyboardCard = card(body, "Enable & switch keyboard")
        helperText(
            keyboardCard,
            "Enable Speech Keyboard in Android settings, then select it. Tap 🌐 on the toolbar anytime to switch back.",
        )
        val setupActions = horizontalRow(keyboardCard, topMarginDp = 12)
        setupActions.addView(
            pillButton("Enable keyboard", ButtonKind.PRIMARY) {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            },
            equalWeight(endMarginDp = 8),
        )
        setupActions.addView(
            pillButton("Choose keyboard", ButtonKind.SECONDARY) {
                getSystemService(InputMethodManager::class.java).showInputMethodPicker()
            },
            equalWeight(),
        )

        // Card 3: Typing, Suggestions & Dictionary
        val typingCard = card(body, "Typing & suggestions")
        addSwitchRow(
            typingCard,
            "Haptic feedback",
            "Light tap vibration when pressing keys",
            settings.haptics,
        ) { settings.haptics = it }
        divider(typingCard)
        addSwitchRow(
            typingCard,
            "Key press preview",
            "Show floating character badge above tapped keys",
            settings.previews,
        ) { settings.previews = it }
        divider(typingCard)
        addSwitchRow(
            typingCard,
            "On-device suggestions & learning",
            "Word completions and shortcut expansion (always off in passwords)",
            settings.suggestions,
        ) { settings.suggestions = it }
        divider(typingCard)

        fieldLabel(typingCard, "Foldable / wide-screen split layout", topMarginDp = 10)
        val splitValues = listOf("auto", "on", "off")
        val splitSpinner = styledSpinner(
            listOf("Automatic — wide or landscape screens", "Always split on wide screens", "Never split"),
            splitValues.indexOf(settings.splitLayout).coerceAtLeast(0),
        ) { position ->
            settings.splitLayout = splitValues[position]
        }
        typingCard.addView(splitSpinner, fullWidth(topMarginDp = 6, bottomMarginDp = 14))

        fieldLabel(typingCard, "Personal dictionary (Gboard import)")
        dictionarySummary = TextView(this).apply {
            textSize = 12.5f
            setTextColor(COLOR_ACCENT_LIGHT)
            setPadding(0, dp(3), 0, dp(4))
        }.also { typingCard.addView(it) }
        helperText(
            typingCard,
            "Export from Gboard → Settings → Dictionary → Personal dictionary → ⋮ → Export, then import the .zip or .txt file here.",
        )
        val dictActions = horizontalRow(typingCard, topMarginDp = 10)
        dictActions.addView(
            pillButton("Import Gboard file", ButtonKind.SECONDARY) {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/plain", "application/zip", "application/octet-stream"))
                }
                @Suppress("DEPRECATION")
                startActivityForResult(intent, REQ_IMPORT_GBOARD)
            },
            equalWeight(endMarginDp = 8),
        )
        dictActions.addView(
            pillButton("Clear dictionary", ButtonKind.DANGER) {
                WordDictionary(this).clearLearned()
                refreshStatus()
                Toast.makeText(this, "Cleared local dictionary and shortcuts", Toast.LENGTH_SHORT).show()
            },
            equalWeight(),
        )

        // Card 4: Try It Here
        val testCard = card(body, "Try it here")
        val sandbox = styledInput("Type or tap Mic to test Flux dictation, suggestions, and key feel…", password = false).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setSingleLine(false)
            minLines = 3
            gravity = Gravity.TOP or Gravity.START
        }
        testCard.addView(sandbox, fullWidth(topMarginDp = 6, bottomMarginDp = 10))
        helperText(
            testCard,
            "Double-tap Shift for Caps Lock · Hold Backspace to repeat · Hold letters for corner symbols · Tap ☺ for emoji · Inline Autofill chips appear automatically on supported fields.",
        )

        setContentView(scroll)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::apiKeyPill.isInitialized) refreshStatus()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshStatus()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_IMPORT_GBOARD && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            try {
                contentResolver.openInputStream(uri)?.use { stream ->
                    val result = WordDictionary(this).importStream(stream)
                    refreshStatus()
                    Toast.makeText(
                        this,
                        "Imported ${result.wordsImported} words and ${result.shortcutsImported} shortcuts",
                        Toast.LENGTH_LONG,
                    ).show()
                }
            } catch (_: Exception) {
                Toast.makeText(this, "Could not read Gboard dictionary file.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun refreshStatus() {
        val hasKey = settings.hasApiKey()
        val hasMic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val imm = getSystemService(InputMethodManager::class.java)
        val isEnabled = try {
            imm?.enabledInputMethodList?.any { it.packageName == packageName } == true
        } catch (_: Exception) {
            false
        }
        val isActive = try {
            Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
                ?.startsWith("$packageName/") == true
        } catch (_: Exception) {
            false
        }

        styleBadge(apiKeyPill, if (hasKey) "✓ API key saved" else "• API key needed", hasKey)
        styleBadge(micPill, if (hasMic) "✓ Mic allowed" else "• Mic needed", hasMic)
        styleBadge(enabledPill, if (isEnabled) "✓ Keyboard enabled" else "• Enable keyboard", isEnabled)
        styleBadge(activePill, if (isActive) "✓ Active keyboard" else "• Not active", isActive)

        val dict = WordDictionary(this)
        dictionarySummary.text = "Local dictionary: ${dict.learnedWordCount()} learned words · ${dict.shortcutCount()} shortcuts"
    }

    private enum class ButtonKind { PRIMARY, SECONDARY, DANGER }

    private fun card(parent: LinearLayout, title: String): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(16))
            background = roundedBox(COLOR_CARD, COLOR_BORDER, radiusDp = 16)
        }
        container.addView(TextView(this).apply {
            text = title
            textSize = 16f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setTextColor(COLOR_TEXT_PRIMARY)
            setPadding(0, 0, 0, dp(8))
        })
        parent.addView(container, fullWidth(bottomMarginDp = 14))
        return container
    }

    private fun horizontalRow(parent: LinearLayout, topMarginDp: Int = 0, bottomMarginDp: Int = 0): LinearLayout =
        LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }.also {
            parent.addView(it, fullWidth(topMarginDp = topMarginDp, bottomMarginDp = bottomMarginDp))
        }

    private fun statusBadge(): TextView = TextView(this).apply {
        textSize = 12.5f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        gravity = Gravity.CENTER
        setPadding(dp(10), dp(8), dp(10), dp(8))
    }

    private fun styleBadge(view: TextView, label: String, ok: Boolean) {
        view.text = label
        view.setTextColor(if (ok) Color.rgb(110, 231, 183) else Color.rgb(252, 165, 165))
        view.background = roundedBox(
            fill = if (ok) Color.rgb(22, 48, 38) else Color.rgb(49, 28, 34),
            stroke = if (ok) Color.rgb(38, 92, 70) else Color.rgb(92, 48, 58),
            radiusDp = 12,
        )
    }

    private fun fieldLabel(parent: LinearLayout, label: String, topMarginDp: Int = 0) {
        parent.addView(TextView(this).apply {
            text = label
            textSize = 13.5f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(COLOR_TEXT_PRIMARY)
            setPadding(0, dp(topMarginDp), 0, 0)
        })
    }

    private fun helperText(parent: LinearLayout, value: String) {
        parent.addView(TextView(this).apply {
            text = value
            textSize = 12.5f
            setTextColor(COLOR_TEXT_MUTED)
            setLineSpacing(dp(2).toFloat(), 1f)
        })
    }

    private fun divider(parent: LinearLayout) {
        parent.addView(
            View(this).apply { setBackgroundColor(COLOR_BORDER) },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1).coerceAtLeast(1)).apply {
                topMargin = dp(8)
                bottomMargin = dp(8)
            },
        )
    }

    private fun addSwitchRow(
        parent: LinearLayout,
        title: String,
        subtitle: String,
        checked: Boolean,
        onToggle: (Boolean) -> Unit,
    ) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(2), 0, dp(2))
        }
        val labels = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        labels.addView(TextView(this).apply {
            text = title
            textSize = 14.5f
            setTextColor(COLOR_TEXT_PRIMARY)
        })
        labels.addView(TextView(this).apply {
            text = subtitle
            textSize = 12f
            setTextColor(COLOR_TEXT_MUTED)
        })
        row.addView(labels, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(12)
        })
        val toggle = Switch(this).apply {
            isChecked = checked
            contentDescription = title
            setOnCheckedChangeListener { _, enabled -> onToggle(enabled) }
        }
        row.addView(toggle)
        parent.addView(row, fullWidth())
    }

    private fun styledInput(placeholder: String, password: Boolean): EditText = EditText(this).apply {
        hint = placeholder
        setHintTextColor(Color.rgb(112, 122, 142))
        setTextColor(COLOR_TEXT_PRIMARY)
        textSize = 14.5f
        setPadding(dp(14), dp(12), dp(14), dp(12))
        background = roundedBox(COLOR_INPUT, COLOR_BORDER, radiusDp = 12)
        if (password) {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            imeOptions = android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
            setSingleLine(true)
        }
    }

    private fun styledSpinner(items: List<String>, selectedIndex: Int, onSelected: (Int) -> Unit): Spinner =
        Spinner(this).apply {
            background = roundedBox(COLOR_INPUT, COLOR_BORDER, radiusDp = 12)
            setPadding(dp(10), dp(6), dp(10), dp(6))
            adapter = object : ArrayAdapter<String>(this@SetupActivity, android.R.layout.simple_spinner_dropdown_item, items) {
                override fun getView(position: Int, convertView: View?, parent: ViewGroup): View =
                    (super.getView(position, convertView, parent) as TextView).apply {
                        setTextColor(COLOR_TEXT_PRIMARY)
                        textSize = 13.5f
                    }

                override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View =
                    (super.getDropDownView(position, convertView, parent) as TextView).apply {
                        setBackgroundColor(COLOR_CARD)
                        setTextColor(COLOR_TEXT_PRIMARY)
                        textSize = 13.5f
                        setPadding(dp(14), dp(12), dp(14), dp(12))
                    }
            }
            setSelection(selectedIndex)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    onSelected(position)
                }
                override fun onNothingSelected(parent: AdapterView<*>?) { }
            }
        }

    private fun pillButton(label: String, kind: ButtonKind, action: () -> Unit): Button = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 13.5f
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        stateListAnimator = null
        minHeight = dp(42)
        minimumHeight = dp(42)
        setPadding(dp(14), dp(8), dp(14), dp(8))
        when (kind) {
            ButtonKind.PRIMARY -> {
                setTextColor(Color.WHITE)
                background = roundedBox(COLOR_ACCENT, COLOR_ACCENT, radiusDp = 12)
            }
            ButtonKind.SECONDARY -> {
                setTextColor(COLOR_TEXT_PRIMARY)
                background = roundedBox(Color.rgb(38, 43, 54), Color.rgb(58, 66, 84), radiusDp = 12)
            }
            ButtonKind.DANGER -> {
                setTextColor(Color.rgb(252, 165, 165))
                background = roundedBox(Color.rgb(46, 26, 33), Color.rgb(98, 48, 60), radiusDp = 12)
            }
        }
        setOnClickListener { action() }
    }

    private fun roundedBox(fill: Int, stroke: Int, radiusDp: Int) = GradientDrawable().apply {
        cornerRadius = dp(radiusDp).toFloat()
        setColor(fill)
        setStroke(dp(1).coerceAtLeast(1), stroke)
    }

    private fun fullWidth(topMarginDp: Int = 0, bottomMarginDp: Int = 0) =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(topMarginDp)
            bottomMargin = dp(bottomMarginDp)
        }

    private fun equalWeight(endMarginDp: Int = 0) =
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(endMarginDp)
        }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val REQ_IMPORT_GBOARD = 2001
        private val COLOR_BG = Color.rgb(15, 17, 23)
        private val COLOR_CARD = Color.rgb(25, 28, 36)
        private val COLOR_INPUT = Color.rgb(18, 20, 27)
        private val COLOR_BORDER = Color.rgb(42, 48, 62)
        private val COLOR_ACCENT = Color.rgb(79, 124, 255)
        private val COLOR_ACCENT_LIGHT = Color.rgb(154, 186, 255)
        private val COLOR_TEXT_PRIMARY = Color.rgb(242, 244, 248)
        private val COLOR_TEXT_MUTED = Color.rgb(148, 158, 178)
    }
}
