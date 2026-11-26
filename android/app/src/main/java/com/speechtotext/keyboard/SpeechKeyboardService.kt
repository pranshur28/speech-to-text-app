package com.speechtotext.keyboard

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.Icon
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.text.InputType
import android.util.Size
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InlineSuggestionsRequest
import android.view.inputmethod.InlineSuggestionsResponse
import android.view.inputmethod.InputMethodManager
import android.widget.inline.InlinePresentationSpec
import androidx.annotation.RequiresApi
import androidx.autofill.inline.UiVersions
import androidx.autofill.inline.common.TextViewStyle
import androidx.autofill.inline.common.ViewStyle
import androidx.autofill.inline.v1.InlineSuggestionUi

class SpeechKeyboardService : InputMethodService() {
    private var page = KeyboardPage.LETTERS
    private var shift = false
    private var capsLock = false
    private var lastShift = 0L
    private var password = false
    private var editor: EditorInfo? = null
    private var root: KeyboardSurface? = null
    private var session: DictationSession? = null
    private var generation = 0L
    private var inlineGeneration = 0L
    private var stopping = false
    private var composing = ""
    private var composingStart = -1
    private var expectedSelection = -1
    private var selectionStart = -1
    private var selectionEnd = -1
    private var segmentPrefix = ""

    override fun onCreateInputView(): View {
        return KeyboardSurface(this, object : KeyboardSurface.Actions {
            override fun onKey(spec: KeySpec) { handleKey(spec) }
            override fun onSettings() { cancelDictation(); openSettings() }
            override fun onSwitchKeyboard() {
                cancelDictation()
                getSystemService(InputMethodManager::class.java).showInputMethodPicker()
            }
            override fun onMic() { toggleMic() }
        }).also { root = it; rebuild() }
    }

    override fun onEvaluateFullscreenMode() = false

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        cancelDictation()
        clearInlineSuggestions()
        super.onStartInput(attribute, restarting)
        editor = attribute
        selectionStart = attribute?.initialSelStart ?: -1
        selectionEnd = attribute?.initialSelEnd ?: -1
        password = EditorPolicy.isPassword(attribute?.inputType ?: 0)
        page = if (EditorPolicy.isNumeric(attribute?.inputType ?: 0)) KeyboardPage.NUMBERS else KeyboardPage.LETTERS
        capsLock = false
        shift = !password && ((attribute?.inputType ?: 0) and InputType.TYPE_TEXT_FLAG_CAP_SENTENCES != 0)
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        rebuild()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        cancelDictation(); root?.dismissFeedback()
        super.onFinishInputView(finishingInput)
    }

    override fun onFinishInput() {
        cancelDictation(); clearInlineSuggestions(); root?.dismissFeedback()
        super.onFinishInput()
        editor = null
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        cancelDictation(); root?.dismissFeedback()
        super.onConfigurationChanged(newConfig)
        rebuild()
    }

    override fun onDestroy() {
        cancelDictation(); root?.dismissFeedback()
        super.onDestroy()
    }

    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int,
                                   candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        selectionStart = newSelStart
        selectionEnd = newSelEnd
        if (session != null && EditorPolicy.cursorLeftDictation(newSelStart, newSelEnd, expectedSelection, candidatesEnd)) {
            cancelDictation()
            setStatus("Cursor moved — tap Mic to continue")
        }
    }

    private fun rebuild() {
        val settings = KeyboardSettings(this)
        val enter = if ((editor?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0) "Enter"
            else EditorPolicy.actionLabel(editor?.imeOptions ?: 0)
        root?.render(KeyboardSurface.State(
            page, shift, capsLock, password, session != null, enter,
            settings.haptics, settings.previews, settings.splitLayout,
            when {
                password -> "Password — typing only"
                stopping -> "Finishing…"
                session != null -> "Listening…"
                page == KeyboardPage.NUMBERS -> "Numbers & punctuation · 1/3"
                page == KeyboardPage.SYMBOLS -> "Symbols & currency · 2/3"
                page == KeyboardPage.MATH -> "Mathematics · 3/3"
                page == KeyboardPage.EMOJI -> "Emoji · hold for variants"
                else -> "Hold a key for its symbol"
            },
        ))
    }

    private fun handleKey(spec: KeySpec) {
        when (spec.action) {
            KeyAction.TEXT -> type(spec.output)
            KeyAction.SPACE -> type(" ")
            KeyAction.DELETE -> delete()
            KeyAction.ENTER -> enter()
            KeyAction.PAGE, KeyAction.EMOJI -> {
                cancelDictation()
                page = spec.page ?: KeyboardPage.EMOJI
                rebuild()
            }
            KeyAction.SHIFT -> {
                cancelDictation()
                val now = SystemClock.uptimeMillis()
                if (now - lastShift < 350 && shift) { capsLock = true; shift = true }
                else if (capsLock) { capsLock = false; shift = false }
                else shift = !shift
                lastShift = now
                root?.updateShift(shift, capsLock)
            }
        }
    }

    private fun type(value: String) {
        cancelDictationForEditing()
        if (currentInputConnection?.commitText(value, 1) != true) setStatus("Tap a text field first")
        if (shift && !capsLock && value.any { it.isLetter() }) {
            shift = false
            root?.updateShift(shift, capsLock)
        }
    }

    private fun delete() {
        cancelDictationForEditing()
        val connection = currentInputConnection ?: return
        val hasSelection = if (selectionStart >= 0 && selectionEnd >= 0) selectionStart != selectionEnd else null
        TextEditing.backspace(connection, hasSelection)
    }

    private fun enter() {
        cancelDictationForEditing()
        val info = editor ?: return
        val action = info.imeOptions and EditorInfo.IME_MASK_ACTION
        if (info.imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION == 0 &&
            action !in setOf(EditorInfo.IME_ACTION_NONE, EditorInfo.IME_ACTION_UNSPECIFIED)) {
            currentInputConnection?.performEditorAction(action)
        } else currentInputConnection?.commitText("\n", 1)
    }

    private fun toggleMic() {
        if (session != null) {
            if (!stopping) { stopping = true; setStatus("Finishing…"); session?.stop() }
            return
        }
        if (password || !isInputViewShown) return
        val connection = currentInputConnection ?: return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            setStatus("Allow microphone in Settings"); openSettings(); return
        }
        val settings = KeyboardSettings(this)
        val apiKey = try { settings.readApiKey() } catch (_: Exception) {
            setStatus("Save your API key again in Settings"); return
        }
        if (apiKey.isBlank()) { setStatus("Add a Deepgram key in Settings"); openSettings(); return }
        if (selectionStart < 0) { setStatus("Tap the text field again before dictating"); return }
        // Avoid replacing a selection just by starting dictation.
        if (!connection.getSelectedText(0).isNullOrEmpty()) {
            setStatus("Place the cursor before dictating"); return
        }
        val token = ++generation
        stopping = false
        expectedSelection = selectionStart
        session = DictationSession(apiKey, settings.engine, object : DictationSession.Listener {
            override fun onListening() { if (generation == token) setStatus("Listening… tap Stop to finish") }
            override fun onTranscript(event: TranscriptEvent) {
                if (generation != token || !isInputViewShown) return
                applyTranscript(event)
            }
            override fun onFinished(error: String?) {
                if (generation != token) return
                session = null; stopping = false
                finishComposition()
                setStatus(error ?: "Ready — type or tap Mic")
            }
        })
        setStatus("Connecting…")
        try { session?.start() } catch (_: Exception) {
            cancelDictation(); setStatus("Could not connect. Check your connection and settings.")
        }
    }

    private fun applyTranscript(event: TranscriptEvent) {
        val connection = currentInputConnection ?: run { cancelDictation(); return }
        if (composing.isEmpty()) {
            composingStart = selectionStart
            val previous = connection.getTextBeforeCursor(1, 0)?.lastOrNull()
            segmentPrefix = if (previous != null && !previous.isWhitespace() && previous !in "([{/@-_") " " else ""
        }
        val target = segmentPrefix + event.text
        expectedSelection = if (composingStart >= 0) composingStart + target.length else -1
        composing = target
        if (!connection.setComposingText(target, 1)) {
            cancelDictation(); setStatus("This field rejected dictation"); return
        }
        if (event.final) {
            // Commit the current composing region, without synthetic deletes or clipboard writes.
            connection.finishComposingText()
            selectionStart = expectedSelection
            selectionEnd = expectedSelection
            composing = ""; segmentPrefix = ""; composingStart = -1
        }
    }

    private fun finishComposition() {
        if (composing.isNotEmpty()) currentInputConnection?.finishComposingText()
        composing = ""; segmentPrefix = ""; composingStart = -1; expectedSelection = -1
    }

    private fun cancelDictationForEditing() {
        if (session != null || stopping || composing.isNotEmpty()) cancelDictation()
    }

    private fun cancelDictation() {
        generation++
        session?.cancel(); session = null; stopping = false
        finishComposition()
        setStatus(if (password) "Password — typing only" else "Type or tap Mic")
    }

    private fun openSettings() {
        startActivity(Intent(this, SetupActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @RequiresApi(Build.VERSION_CODES.R)
    @SuppressLint("RestrictedApi")
    override fun onCreateInlineSuggestionsRequest(uiExtras: Bundle): InlineSuggestionsRequest {
        val density = resources.displayMetrics.density
        fun px(dp: Int) = (dp * density).toInt()
        val chipStyle = InlineSuggestionUi.newStyleBuilder()
            .setSingleIconChipStyle(
                ViewStyle.Builder()
                    .setBackground(Icon.createWithResource(this, R.drawable.bg_inline_chip))
                    .setPadding(px(8), px(4), px(8), px(4))
                    .build()
            )
            .setChipStyle(
                ViewStyle.Builder()
                    .setBackground(Icon.createWithResource(this, R.drawable.bg_inline_chip))
                    .setPadding(px(12), px(4), px(12), px(4))
                    .build()
            )
            .setTitleStyle(
                TextViewStyle.Builder()
                    .setTextColor(Color.rgb(242, 244, 248))
                    .setTextSize(13f)
                    .build()
            )
            .setSubtitleStyle(
                TextViewStyle.Builder()
                    .setTextColor(Color.rgb(154, 164, 184))
                    .setTextSize(11f)
                    .build()
            )
            .build()
        val stylesBundle = UiVersions.newStylesBuilder().addStyle(chipStyle).build()
        val spec = InlinePresentationSpec.Builder(Size(px(56), px(34)), Size(px(260), px(36)))
            .setStyle(stylesBundle)
            .build()
        return InlineSuggestionsRequest.Builder(listOf(spec))
            .setMaxSuggestionCount(InlineSuggestionsRequest.SUGGESTION_COUNT_UNLIMITED)
            .build()
    }

    @RequiresApi(Build.VERSION_CODES.R)
    override fun onInlineSuggestionsResponse(response: InlineSuggestionsResponse): Boolean {
        val token = ++inlineGeneration
        root?.clearInlineSuggestions()
        val suggestions = response.inlineSuggestions
        if (suggestions.isEmpty()) return true
        val heightPx = (36 * resources.displayMetrics.density).toInt()
        val size = Size(ViewGroup.LayoutParams.WRAP_CONTENT, heightPx)
        for (suggestion in suggestions) {
            suggestion.inflate(this, size, mainExecutor) { view ->
                if (view != null && inlineGeneration == token) {
                    root?.addInlineSuggestionView(view)
                }
            }
        }
        return true
    }

    private fun clearInlineSuggestions() {
        inlineGeneration++
        root?.clearInlineSuggestions()
    }

    private fun setStatus(value: String) { root?.updateStatus(value, session != null) }
}
