package com.speechtotext.keyboard

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.widget.Button

/** Native click semantics, with feedback on touch-down and a distinct pressed background. */
class KeyboardKeyView(context: Context) : Button(context) {
    var feedbackEnabled = true
    var alternate: String? = null
    var onPreview: ((KeyboardKeyView, Boolean) -> Unit)? = null
    var onAlternate: (() -> Unit)? = null
    var onRepeat: (() -> Unit)? = null
    private var longPressConsumed = false
    private val handler = Handler(Looper.getMainLooper())
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(150, 155, 166)
        textSize = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_SP, 10f, resources.displayMetrics)
        textAlign = Paint.Align.RIGHT
    }
    private val repeat = object : Runnable {
        override fun run() {
            if (!isPressed || !isAttachedToWindow) return
            onRepeat?.invoke()
            handler.postDelayed(this, 65)
        }
    }

    init {
        isAllCaps = false; minWidth = 0; minimumWidth = 0; minHeight = 0; minimumHeight = 0
        setPadding(0, 0, 0, 0)
        setTextColor(Color.rgb(238, 240, 244))
        textSize = 20f
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
        stateListAnimator = null
        background = makeBackground()
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

    // Keep native press/long-press handling, but dispatch release without a posted click.
    @android.annotation.SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (isEnabled) when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                longPressConsumed = false
                if (feedbackEnabled) performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                onPreview?.invoke(this, true)
            }
            MotionEvent.ACTION_MOVE -> if (event.x < 0 || event.y < 0 || event.x >= width || event.y >= height) {
                handler.removeCallbacks(repeat)
                onPreview?.invoke(this, false)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                handler.removeCallbacks(repeat)
                onPreview?.invoke(this, false)
                if (event.actionMasked == MotionEvent.ACTION_UP) {
                    val click = isPressed && !longPressConsumed
                    val cancel = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_CANCEL }
                    super.onTouchEvent(cancel)
                    cancel.recycle()
                    if (click) performClick()
                    return true
                }
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

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        alternate?.let { canvas.drawText(it, width - dp(6).toFloat(), dp(12).toFloat(), hintPaint) }
    }

    override fun onDetachedFromWindow() {
        cancelInteraction()
        super.onDetachedFromWindow()
    }

    fun cancelInteraction() { handler.removeCallbacksAndMessages(null); isPressed = false }

    private fun makeBackground(): RippleDrawable {
        fun fill(color: Int) = GradientDrawable().apply { cornerRadius = dp(9).toFloat(); setColor(color) }
        val states = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), fill(Color.rgb(91, 111, 143)))
            addState(intArrayOf(), fill(Color.rgb(35, 38, 45)))
        }
        return RippleDrawable(ColorStateList.valueOf(Color.rgb(139, 170, 216)), states, fill(Color.WHITE))
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
