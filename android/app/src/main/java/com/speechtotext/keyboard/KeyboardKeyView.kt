package com.speechtotext.keyboard

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button

/** Visual role for Matte Graphite keycap rendering. */
enum class KeyStyle {
    LETTER,
    MODIFIER,
    MODIFIER_ACTIVE,
    SPACE,
    ACTION,
    TOOLBAR,
    MIC,
    MIC_ACTIVE,
}

/**
 * Lightweight canvas-drawn key view:
 * - Draws its own inset rounded Matte Graphite keycap + subtle drop shadow (zero dead zones, no RippleDrawable).
 * - Handles touch/slop/long-press directly without allocating synthetic MotionEvent objects.
 * - Label & style updates only invalidate without triggering TextView relayout.
 */
class KeyboardKeyView(context: Context) : View(context) {
    var feedbackEnabled = true
    var alternate: String? = null
    var onPreview: ((KeyboardKeyView, Boolean) -> Unit)? = null
    var onAlternate: (() -> Unit)? = null
    var onRepeat: (() -> Unit)? = null
    private var longPressConsumed = false
    private val handler = Handler(Looper.getMainLooper())
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop.toFloat()
    private val longPressTimeout = ViewConfiguration.getLongPressTimeout().toLong()
    private val insetX = dp(2.5f)
    private val insetY = dp(3.5f)
    private val shadowOffsetY = dp(1.5f)
    private val keyCornerRadius = dp(8f)
    private val pillCornerRadius = dp(16f)
    private val keyRect = RectF()
    private val shadowRect = RectF()
    private val regularTypeface = Typeface.create("sans-serif", Typeface.NORMAL)
    private val mediumTypeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.rgb(10, 11, 16)
    }
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.rgb(42, 46, 56)
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(242, 244, 248)
        textSize = sp(20f)
        textAlign = Paint.Align.CENTER
        typeface = regularTypeface
    }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(139, 147, 166)
        textSize = sp(10f)
        textAlign = Paint.Align.RIGHT
    }
    var keyStyle: KeyStyle = KeyStyle.LETTER
        set(value) {
            if (field == value) return
            field = value
            applyStylePaint()
            invalidate()
        }
    var text: CharSequence = ""
        set(value) {
            if (field.toString() == value.toString()) return
            field = value
            invalidate()
        }
    var textSize: Float = 20f
        set(value) {
            if (field == value) return
            field = value
            labelPaint.textSize = sp(value)
            invalidate()
        }
    fun setText(resId: Int) { text = context.getString(resId) }

    private val repeat = object : Runnable {
        override fun run() {
            if (!isPressed || !isAttachedToWindow) return
            onRepeat?.invoke()
            handler.postDelayed(this, 65)
        }
    }
    private val longPressRunnable = Runnable {
        if (isPressed && isAttachedToWindow && hasLongPressAction()) {
            performLongClick()
        }
    }

    init {
        isClickable = true
        isLongClickable = true
        minimumWidth = 0
        minimumHeight = 0
        stateListAnimator = null
        setOnLongClickListener {
            when {
                onRepeat != null -> {
                    onRepeat?.invoke()
                    if (isPressed) handler.postDelayed(repeat, 65)
                    true
                }
                onAlternate != null -> {
                    if (feedbackEnabled) performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    onPreview?.invoke(this, false)
                    onAlternate?.invoke()
                    true
                }
                else -> false
            }
        }
    }

    private fun hasLongPressAction(): Boolean = onRepeat != null || onAlternate != null

    // Direct touch handling avoids synthetic MotionEvent allocations and tolerates minor finger drift within touchSlop.
    @android.annotation.SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!isEnabled) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                longPressConsumed = false
                handler.removeCallbacks(longPressRunnable)
                handler.removeCallbacks(repeat)
                isPressed = true
                invalidate()
                if (feedbackEnabled) performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                onPreview?.invoke(this, true)
                if (hasLongPressAction()) handler.postDelayed(longPressRunnable, longPressTimeout)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val inside = event.x >= -touchSlop && event.y >= -touchSlop &&
                    event.x < width + touchSlop && event.y < height + touchSlop
                if (!inside && isPressed) {
                    handler.removeCallbacks(longPressRunnable)
                    handler.removeCallbacks(repeat)
                    isPressed = false
                    invalidate()
                    onPreview?.invoke(this, false)
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                handler.removeCallbacks(longPressRunnable)
                handler.removeCallbacks(repeat)
                val click = isPressed && !longPressConsumed
                isPressed = false
                invalidate()
                onPreview?.invoke(this, false)
                if (click) performClick()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                handler.removeCallbacks(longPressRunnable)
                handler.removeCallbacks(repeat)
                isPressed = false
                invalidate()
                onPreview?.invoke(this, false)
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean = super.performClick()

    override fun performLongClick(): Boolean {
        val consumed = super.performLongClick()
        longPressConsumed = consumed
        return consumed
    }

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        info.className = Button::class.java.name
        info.text = text
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val left = insetX
        val top = insetY
        val right = (width - insetX).coerceAtLeast(left)
        val bottom = (height - insetY).coerceAtLeast(top)
        val radius = when (keyStyle) {
            KeyStyle.SPACE, KeyStyle.ACTION, KeyStyle.TOOLBAR, KeyStyle.MIC, KeyStyle.MIC_ACTIVE ->
                minOf(pillCornerRadius, (bottom - top) / 2f)
            else -> keyCornerRadius
        }
        val hasShadow = keyStyle != KeyStyle.TOOLBAR && !isPressed
        if (hasShadow && bottom > top) {
            shadowRect.set(left, top + shadowOffsetY, right, bottom + shadowOffsetY)
            canvas.drawRoundRect(shadowRect, radius, radius, shadowPaint)
        }
        keyRect.set(left, top, right, bottom)
        backgroundPaint.color = fillColor(isPressed)
        canvas.drawRoundRect(keyRect, radius, radius, backgroundPaint)
        val label = text.toString()
        if (label.isNotEmpty()) {
            val metrics = labelPaint.fontMetrics
            val baseline = height / 2f - (metrics.ascent + metrics.descent) / 2f
            canvas.drawText(label, width / 2f, baseline, labelPaint)
        }
        alternate?.let { canvas.drawText(it, right - dp(5f), top + dp(11f), hintPaint) }
    }

    private fun applyStylePaint() {
        labelPaint.color = when (keyStyle) {
            KeyStyle.SPACE -> Color.rgb(142, 151, 170)
            KeyStyle.MODIFIER -> Color.rgb(212, 218, 232)
            KeyStyle.ACTION, KeyStyle.MIC_ACTIVE -> Color.WHITE
            KeyStyle.MIC -> Color.rgb(207, 224, 255)
            KeyStyle.TOOLBAR -> Color.rgb(206, 214, 230)
            else -> Color.rgb(242, 244, 248)
        }
        labelPaint.typeface = when (keyStyle) {
            KeyStyle.ACTION, KeyStyle.MIC, KeyStyle.MIC_ACTIVE, KeyStyle.MODIFIER_ACTIVE -> mediumTypeface
            else -> regularTypeface
        }
    }

    private fun fillColor(pressed: Boolean): Int = when (keyStyle) {
        KeyStyle.LETTER -> if (pressed) Color.rgb(66, 74, 94) else Color.rgb(42, 46, 56)
        KeyStyle.MODIFIER -> if (pressed) Color.rgb(48, 54, 69) else Color.rgb(29, 32, 40)
        KeyStyle.MODIFIER_ACTIVE -> if (pressed) Color.rgb(74, 96, 143) else Color.rgb(57, 75, 114)
        KeyStyle.SPACE -> if (pressed) Color.rgb(59, 66, 84) else Color.rgb(37, 41, 51)
        KeyStyle.ACTION -> if (pressed) Color.rgb(108, 147, 255) else Color.rgb(79, 124, 255)
        KeyStyle.TOOLBAR -> if (pressed) Color.rgb(45, 50, 64) else Color.rgb(28, 31, 39)
        KeyStyle.MIC -> if (pressed) Color.rgb(53, 69, 106) else Color.rgb(37, 48, 74)
        KeyStyle.MIC_ACTIVE -> if (pressed) Color.rgb(240, 104, 119) else Color.rgb(224, 79, 95)
    }

    override fun onDetachedFromWindow() {
        cancelInteraction()
        super.onDetachedFromWindow()
    }

    fun cancelInteraction() {
        handler.removeCallbacksAndMessages(null)
        isPressed = false
        invalidate()
    }

    private fun dp(value: Float) = value * resources.displayMetrics.density
    private fun sp(value: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)
}
