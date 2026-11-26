package com.speechtotext.keyboard

import android.content.Context
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Build
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.emoji2.emojipicker.EmojiPickerView

/** Lightweight preview badge that draws directly on Canvas so text changes never trigger layout. */
internal class KeyPreviewView(context: Context) : View(context) {
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 30f, resources.displayMetrics)
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }

    var label: CharSequence = ""
        set(value) {
            if (field.toString() == value.toString()) return
            field = value
            invalidate()
        }

    init {
        val density = resources.displayMetrics.density
        background = GradientDrawable().apply {
            cornerRadius = 14 * density
            setColor(Color.rgb(59, 70, 94))
            setStroke((1 * density).toInt().coerceAtLeast(1), Color.rgb(88, 104, 138))
        }
        visibility = INVISIBLE
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        contentDescription = "Pressed key preview"
        isClickable = false
        isFocusable = false
        elevation = 8 * density
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val text = label.toString()
        if (text.isEmpty()) return
        val metrics = textPaint.fontMetrics
        val baseline = height / 2f - (metrics.ascent + metrics.descent) / 2f
        canvas.drawText(text, width / 2f, baseline, textPaint)
    }
}

/** Rendering and touch feedback are isolated from editor/microphone state. */
@android.annotation.SuppressLint("ViewConstructor") // Constructed by the IME with editor callbacks, not XML.
class KeyboardSurface(context: Context, private val actions: Actions) : FrameLayout(context) {
    interface Actions {
        fun onKey(spec: KeySpec)
        fun onSettings()
        fun onSwitchKeyboard()
        fun onMic()
    }
    data class State(
        val page: KeyboardPage,
        val shifted: Boolean,
        val capsLock: Boolean,
        val password: Boolean,
        val recording: Boolean,
        val enter: String,
        val haptics: Boolean,
        val previews: Boolean,
        val split: String,
        val message: String,
    )
    private val content = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    private val preview = KeyPreviewView(context)
    private val handler = Handler(Looper.getMainLooper())
    private val hidePreview = Runnable { preview.visibility = View.INVISIBLE }
    private var state: State? = null
    private var status: TextView? = null
    private var inlineScroll: HorizontalScrollView? = null
    private var inlineContainer: LinearLayout? = null
    private var mic: KeyboardKeyView? = null
    private val letterKeys = mutableListOf<KeyboardKeyView>()
    private var shiftKey: KeyboardKeyView? = null
    private var renderedWidth = -1
    private var emojiPicker: EmojiPickerView? = null

    init {
        setBackgroundColor(Color.rgb(18, 19, 24))
        setPadding(dp(4), dp(2), dp(4), dp(24))
        addView(content, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(preview, LayoutParams(dp(58), dp(60)))
    }

    override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {
        val bottom = if (Build.VERSION.SDK_INT >= 30) {
            insets.getInsets(WindowInsets.Type.navigationBars() or WindowInsets.Type.systemGestures()).bottom
        } else {
            @Suppress("DEPRECATION")
            insets.systemWindowInsetBottom
        }
        // Keep the footer above the system gesture area, including on Samsung devices.
        setPadding(dp(4), dp(2), dp(4), maxOf(dp(24), bottom))
        return super.onApplyWindowInsets(insets)
    }

    fun render(next: State) {
        if (state?.page != next.page) {
            handler.removeCallbacks(hidePreview); preview.visibility = View.INVISIBLE
        }
        state = next
        renderedWidth = width
        letterKeys.clear()
        shiftKey = null
        content.removeAllViews()
        val widthDp = if (width > 0) (width / resources.displayMetrics.density).toInt() else resources.configuration.screenWidthDp
        val landscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val split = KeyboardLayouts.shouldSplit(widthDp, landscape, next.split)
        val keyHeight = if (landscape && resources.configuration.screenHeightDp < 500) 44 else 50
        val divider = View(context).apply { setBackgroundColor(Color.rgb(34, 38, 49)) }
        content.addView(divider, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(1).coerceAtLeast(1)))
        val toolbar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(2), 0, dp(2))
        }
        content.addView(toolbar, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(46)))
        toolbar.addView(control("⋯", "Keyboard settings", next, KeyStyle.TOOLBAR) { actions.onSettings() }, weighted(0.95f))
        toolbar.addView(control("🌐", "Switch keyboard", next, KeyStyle.TOOLBAR) { actions.onSwitchKeyboard() }, weighted(0.95f))
        val centerSlot = FrameLayout(context)
        status = TextView(context).apply {
            text = next.message; textSize = 11.5f; setTextColor(Color.rgb(148, 158, 178))
            gravity = Gravity.CENTER_VERTICAL; setPadding(dp(10), 0, dp(8), 0)
            maxLines = 2
        }.also { centerSlot.addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
        inlineContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), 0, dp(4), 0)
        }
        inlineScroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            visibility = View.GONE
            contentDescription = "Inline autofill suggestions"
            addView(inlineContainer, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.MATCH_PARENT))
        }.also { centerSlot.addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
        toolbar.addView(centerSlot, LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 4f))
        mic = control(
            if (next.recording) "Stop" else "Mic",
            "Start or stop dictation",
            next,
            if (next.recording) KeyStyle.MIC_ACTIVE else KeyStyle.MIC,
        ) { actions.onMic() }.apply {
            isEnabled = !next.password; alpha = if (next.password) 0.35f else 1f
        }.also { toolbar.addView(it, weighted(1.35f)) }

        if (next.page == KeyboardPage.EMOJI) {
            val picker = emojiPicker ?: EmojiPickerView(context).also { emojiPicker = it }
            (picker.parent as? android.view.ViewGroup)?.removeView(picker)
            picker.emojiGridColumns = (widthDp / 44).coerceIn(7, 18)
            picker.emojiGridRows = 3.5f
            picker.setOnEmojiPickedListener {
                if (next.haptics) picker.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
                actions.onKey(KeySpec(it.emoji))
            }
            content.addView(picker, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(keyHeight * 4)))
        } else {
            KeyboardLayouts.rows(next.page, next.shifted || next.capsLock).forEach { spec ->
                addRow(spec, next, keyHeight, split, widthDp)
            }
        }
        val splitFooter = split && !landscape && next.page != KeyboardPage.EMOJI
        addRow(KeyboardLayouts.footer(next.page, next.enter, splitFooter), next, keyHeight, splitFooter, widthDp)
    }

    fun updateStatus(message: String, recording: Boolean) {
        if (state?.message != message) status?.text = message
        if (state?.recording != recording) {
            mic?.setText(if (recording) R.string.stop else R.string.mic)
            mic?.keyStyle = if (recording) KeyStyle.MIC_ACTIVE else KeyStyle.MIC
        }
        state = state?.copy(message = message, recording = recording)
    }

    /** Display an inflated Android Inline Autofill chip inside the top toolbar strip. */
    fun addInlineSuggestionView(chip: View) {
        val container = inlineContainer ?: return
        (chip.parent as? android.view.ViewGroup)?.removeView(chip)
        val lp = LinearLayout.LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            marginEnd = dp(6)
        }
        container.addView(chip, lp)
        inlineScroll?.visibility = View.VISIBLE
        status?.visibility = View.GONE
    }

    /** Clear inline autofill chips and restore the status strip. */
    fun clearInlineSuggestions() {
        inlineContainer?.removeAllViews()
        inlineScroll?.visibility = View.GONE
        status?.visibility = View.VISIBLE
    }

    /** Preserve key instances and in-flight touches when case changes without tree traversal or relayout. */
    fun updateShift(shifted: Boolean, capsLock: Boolean) {
        val previous = state ?: return
        state = previous.copy(shifted = shifted, capsLock = capsLock)
        if (previous.page != KeyboardPage.LETTERS) return
        val uppercase = shifted || capsLock
        for (key in letterKeys) {
            val spec = key.tag as? KeySpec ?: continue
            val value = if (uppercase) spec.output.uppercase() else spec.output.lowercase()
            if (spec.output != value) key.tag = spec.copy(label = value, output = value)
            key.text = value
            key.contentDescription = value
        }
        shiftKey?.let {
            it.text = if (capsLock) "⇪" else "⇧"
            it.keyStyle = when {
                capsLock -> KeyStyle.ACTION
                shifted -> KeyStyle.MODIFIER_ACTIVE
                else -> KeyStyle.MODIFIER
            }
        }
    }

    fun dismissFeedback() {
        handler.removeCallbacksAndMessages(null)
        preview.visibility = View.INVISIBLE
        fun clear(view: View) {
            if (view is KeyboardKeyView) view.cancelInteraction()
            if (view is android.view.ViewGroup) for (i in 0 until view.childCount) clear(view.getChildAt(i))
        }
        clear(content)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w > 0 && w != renderedWidth) post { state?.let { if (width != renderedWidth) render(it) } }
    }

    override fun onDetachedFromWindow() {
        handler.removeCallbacksAndMessages(null)
        preview.visibility = View.INVISIBLE
        super.onDetachedFromWindow()
    }

    private fun addRow(row: KeyRow, state: State, height: Int, split: Boolean, widthDp: Int) {
        val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        content.addView(line, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(height)))
        if (split) {
            fun half(keys: List<KeySpec>) = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                line.addView(this, LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
                keys.forEach { addView(makeKey(it, state), weighted(it.weight)) }
            }
            half(row.keys.take(row.splitAt))
            line.addView(View(context).apply { tag = "split-gap" }, LinearLayout.LayoutParams(dp(KeyboardLayouts.gapDp(widthDp)), LayoutParams.MATCH_PARENT))
            half(row.keys.drop(row.splitAt))
        } else {
            if (state.page == KeyboardPage.LETTERS && row.keys.firstOrNull()?.output?.lowercase() == "a") {
                line.addView(View(context), LinearLayout.LayoutParams(0, 1, 0.5f))
            }
            row.keys.forEach { line.addView(makeKey(it, state), weighted(it.weight)) }
            if (state.page == KeyboardPage.LETTERS && row.keys.firstOrNull()?.output?.lowercase() == "a") {
                line.addView(View(context), LinearLayout.LayoutParams(0, 1, 0.5f))
            }
        }
    }

    private fun makeKey(spec: KeySpec, state: State): KeyboardKeyView {
        val label = if (spec.action == KeyAction.SHIFT && state.capsLock) "⇪" else spec.label
        val style = when (spec.action) {
            KeyAction.ENTER -> KeyStyle.ACTION
            KeyAction.SPACE -> KeyStyle.SPACE
            KeyAction.SHIFT -> when {
                state.capsLock -> KeyStyle.ACTION
                state.shifted -> KeyStyle.MODIFIER_ACTIVE
                else -> KeyStyle.MODIFIER
            }
            KeyAction.DELETE, KeyAction.PAGE, KeyAction.EMOJI -> KeyStyle.MODIFIER
            KeyAction.TEXT -> if (spec.output == "," || spec.output == ".") KeyStyle.MODIFIER else KeyStyle.LETTER
        }
        val key = control(label, when (spec.action) {
            KeyAction.SHIFT -> "Shift"; KeyAction.DELETE -> "Backspace"; KeyAction.EMOJI -> "Emoji"
            KeyAction.PAGE -> "Switch to ${spec.page?.name?.lowercase()}"; KeyAction.SPACE -> "Space"; else -> label
        }, state, style) { actions.onKey(spec) }
        key.tag = spec
        if (spec.action == KeyAction.TEXT && spec.output.length == 1 && spec.output[0].isLetter()) {
            letterKeys.add(key)
        } else if (spec.action == KeyAction.SHIFT) {
            shiftKey = key
        }
        key.setOnClickListener { actions.onKey(key.tag as KeySpec) }
        key.alternate = if (!state.password) spec.alternate else null
        if (spec.action == KeyAction.TEXT && spec.alternate != null) key.onAlternate = {
            actions.onKey(KeySpec(spec.alternate))
        }
        if (spec.action == KeyAction.DELETE) key.onRepeat = { actions.onKey(spec) }
        if (spec.action == KeyAction.SPACE) {
            key.textSize = 12f
        }
        if (spec.action == KeyAction.TEXT && state.previews && !state.password) {
            key.onPreview = { view, visible ->
                handler.removeCallbacks(hidePreview)
                if (visible && isAttachedToWindow) {
                    var offsetX = 0f
                    var offsetY = 0f
                    var current: View? = view
                    while (current != null && current !== this) {
                        offsetX += current.left + current.translationX
                        offsetY += current.top + current.translationY
                        current = current.parent as? View
                    }
                    preview.label = view.text
                    preview.translationX = (offsetX + view.width / 2f - dp(29)).coerceIn(0f, (width - dp(58)).coerceAtLeast(0).toFloat())
                    preview.translationY = (offsetY - dp(58)).coerceAtLeast(0f)
                    if (preview.visibility != View.VISIBLE) preview.visibility = View.VISIBLE
                } else handler.postDelayed(hidePreview, 100)
            }
        }
        return key
    }

    private fun control(
        label: String,
        description: String,
        state: State,
        style: KeyStyle = KeyStyle.LETTER,
        action: () -> Unit,
    ) = KeyboardKeyView(context).apply {
        keyStyle = style
        text = label; textSize = if (label.length > 2) 13f else 20f
        feedbackEnabled = state.haptics
        contentDescription = description
        setOnClickListener { action() }
    }

    // Visual key spacing is drawn inside KeyboardKeyView so key hit targets stay edge-to-edge with zero dead zones.
    private fun weighted(weight: Float) = LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, weight)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
