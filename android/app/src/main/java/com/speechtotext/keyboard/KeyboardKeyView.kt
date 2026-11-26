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

/**
 * Lightweight canvas-drawn key view:
 * - Draws its own inset rounded background (zero inter-key touch dead zones, no RippleDrawable overhead).
 * - Handles touch/slop/long-press directly without allocating synthetic MotionEvent objects.
 * - Label updates only invalidate without triggering TextView relayout.
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
    private val insetX = dp(2).toFloat()
    private val insetY = dp(3).toFloat()
    private val cornerRadius = dp(9).toFloat()
    private val keyRect = RectF()
    private val normalFillColor = Color.rgb(35, 38, 45)
    private val pressedFillColor = Color.rgb(91, 111, 143)
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = normalFillColor
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(238, 240, 244)
        textSize = sp(20f)
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(150, 155, 166)
        textSize = sp(10f)
        textAlign = Paint.Align.RIGHT
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
        keyRect.set(insetX, insetY, (width - insetX).coerceAtLeast(insetX), (height - insetY).coerceAtLeast(insetY))
        backgroundPaint.color = if (isPressed) pressedFillColor else normalFillColor
        canvas.drawRoundRect(keyRect, cornerRadius, cornerRadius, backgroundPaint)
        val label = text.toString()
        if (label.isNotEmpty()) {
            val metrics = labelPaint.fontMetrics
            val baseline = height / 2f - (metrics.ascent + metrics.descent) / 2f
            canvas.drawText(label, width / 2f, baseline, labelPaint)
        }
        alternate?.let { canvas.drawText(it, width - insetX - dp(6), insetY + dp(12), hintPaint) }
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

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun sp(value: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)
}
