package com.speechtotext.keyboard

import android.app.Activity
import android.os.SystemClock
import android.text.InputType
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import androidx.emoji2.emojipicker.EmojiPickerView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h780dp")
class KeyboardUiTest {
    private fun state(page: KeyboardPage = KeyboardPage.LETTERS, haptics: Boolean = true, password: Boolean = false) =
        KeyboardSurface.State(page, false, false, password, false, "Enter", haptics, true, "auto", "Ready")

    private fun descendants(view: View): List<View> = listOf(view) + if (view is ViewGroup)
        (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()

    private fun create(page: KeyboardPage = KeyboardPage.LETTERS, haptics: Boolean = true, password: Boolean = false): Pair<KeyboardSurface, EditText> {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val editor = EditText(activity).apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE }
        val connection = editor.onCreateInputConnection(EditorInfo())!!
        val surface = KeyboardSurface(activity, object : KeyboardSurface.Actions {
            override fun onKey(spec: KeySpec) {
                if (spec.action == KeyAction.TEXT) connection.commitText(spec.output, 1)
                if (spec.action == KeyAction.SPACE) connection.commitText(" ", 1)
            }
            override fun onSettings() { }
            override fun onSwitchKeyboard() { }
            override fun onMic() { }
        })
        activity.setContentView(surface)
        surface.render(state(page, haptics, password))
        val width = (activity.resources.configuration.screenWidthDp * activity.resources.displayMetrics.density).toInt()
        surface.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        surface.layout(0, 0, width, surface.measuredHeight)
        shadowOf(android.os.Looper.getMainLooper()).idle()
        surface.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        surface.layout(0, 0, width, surface.measuredHeight)
        return surface to editor
    }

    private fun key(surface: KeyboardSurface, output: String): KeyboardKeyView = descendants(surface)
        .filterIsInstance<KeyboardKeyView>().first { (it.tag as? KeySpec)?.output == output }

    @Test fun `touching a letter gives a pressed state and haptic and inserts once on release`() {
        val (surface, editor) = create()
        val key = key(surface, "a")
        val now = SystemClock.uptimeMillis()
        key.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        assertTrue(key.isPressed)
        assertEquals(HapticFeedbackConstants.KEYBOARD_TAP, shadowOf(key).lastHapticFeedbackPerformed())
        val preview = descendants(surface).first { it.contentDescription == "Pressed key preview" } as KeyPreviewView
        assertEquals(View.VISIBLE, preview.visibility)
        assertEquals("a", preview.label.toString())
        assertFalse("Showing key preview must not trigger keyboard relayout", surface.isLayoutRequested)
        key.dispatchTouchEvent(MotionEvent.obtain(now, now + 50, MotionEvent.ACTION_UP, 10f, 10f, 0))
        // No main-loop idle: insertion must happen in the release callback itself.
        assertEquals("a", editor.text.toString())
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(200))
        assertEquals(View.INVISIBLE, preview.visibility)
        assertFalse("Hiding key preview must not trigger keyboard relayout", surface.isLayoutRequested)
        assertFalse(key.isPressed)
        assertEquals("a", editor.text.toString())
    }

    @Test fun `space touch inserts between letters on every page`() {
        for (page in KeyboardPage.values()) {
            val (surface, editor) = create(page)
            editor.setText("ab"); editor.setSelection(1)
            val space = key(surface, " ")
            assertTrue(space.width > 0 && space.height > 0)
            val now = SystemClock.uptimeMillis()
            space.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, space.width / 2f, space.height / 2f, 0))
            space.dispatchTouchEvent(MotionEvent.obtain(now, now + 50, MotionEvent.ACTION_UP, space.width / 2f, space.height / 2f, 0))
            shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(200))
            assertEquals("Space on $page", "a b", editor.text.toString())
        }
    }

    @Test fun `shift updates output and preview without replacing a pressed space key`() {
        val (surface, editor) = create()
        val letter = key(surface, "a")
        val space = key(surface, " ")
        val now = SystemClock.uptimeMillis()
        space.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        surface.updateShift(true, false)
        assertFalse("Shift toggle must not trigger keyboard relayout", surface.isLayoutRequested)
        assertSame(letter, key(surface, "A"))
        assertSame(space, key(surface, " "))
        assertTrue(space.isPressed)
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        val preview = descendants(surface).first { it.contentDescription == "Pressed key preview" } as KeyPreviewView
        assertEquals("A", preview.label.toString())
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now + 50, MotionEvent.ACTION_UP, 10f, 10f, 0))
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(100))
        surface.updateShift(false, false)
        assertFalse("Auto-unshift must not trigger keyboard relayout", surface.isLayoutRequested)
        space.dispatchTouchEvent(MotionEvent.obtain(now, now + 150, MotionEvent.ACTION_UP, 10f, 10f, 0))
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(100))
        letter.performClick()
        assertEquals("A a", editor.text.toString())
        letter.performLongClick()
        assertEquals("A a@", editor.text.toString())
    }

    @Test fun `cancel and long press do not also insert the base letter on release`() {
        val (surface, editor) = create()
        val letter = key(surface, "a")
        val now = SystemClock.uptimeMillis()
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now + 50, MotionEvent.ACTION_CANCEL, 10f, 10f, 0))
        assertEquals("", editor.text.toString())
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        letter.performLongClick()
        letter.dispatchTouchEvent(MotionEvent.obtain(now, now + 600, MotionEvent.ACTION_UP, 10f, 10f, 0))
        shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofMillis(200))
        assertEquals("@", editor.text.toString())
    }

    @Test fun `setup screen reserves IME space and restores padding when hidden`() {
        val activity = Robolectric.buildActivity(SetupActivity::class.java).setup().get()
        val scroll = activity.findViewById<android.view.ViewGroup>(android.R.id.content).getChildAt(0)
        val shown = android.view.WindowInsets.Builder()
            .setInsets(android.view.WindowInsets.Type.ime(), android.graphics.Insets.of(0, 0, 0, 400))
            .setInsets(android.view.WindowInsets.Type.navigationBars(), android.graphics.Insets.of(0, 0, 0, 24))
            .setVisible(android.view.WindowInsets.Type.ime(), true).build()
        scroll.dispatchApplyWindowInsets(shown)
        assertEquals(400, scroll.paddingBottom)
        val hidden = android.view.WindowInsets.Builder()
            .setInsets(android.view.WindowInsets.Type.navigationBars(), android.graphics.Insets.of(0, 0, 0, 24)).build()
        scroll.dispatchApplyWindowInsets(hidden)
        assertEquals(24, scroll.paddingBottom)
    }

    @Test fun `password presses do not expose a character preview and haptics can be disabled`() {
        val (surface, _) = create(haptics = false, password = true)
        val key = key(surface, "a")
        val now = SystemClock.uptimeMillis()
        key.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        assertNotEquals(HapticFeedbackConstants.KEYBOARD_TAP, shadowOf(key).lastHapticFeedbackPerformed())
        assertEquals(View.INVISIBLE, descendants(surface).first { it.contentDescription == "Pressed key preview" }.visibility)
    }

    @Test fun `underscore backslash comparison and math symbols insert their actual label`() {
        for ((page, symbol) in listOf(KeyboardPage.NUMBERS to "_", KeyboardPage.NUMBERS to "\\", KeyboardPage.NUMBERS to "<",
            KeyboardPage.MATH to "≤", KeyboardPage.MATH to "∫", KeyboardPage.SYMBOLS to "€")) {
            val (surface, editor) = create(page)
            key(surface, symbol).performClick()
            assertEquals(symbol, editor.text.toString())
        }
    }

    @Test fun `long pressing a letter inserts its corner symbol without the letter`() {
        val (surface, editor) = create()
        key(surface, "a").performLongClick()
        assertEquals("@", editor.text.toString())
    }

    @Test @Config(qualifiers = "w840dp-h650dp-land")
    fun `wide landscape splits letter rows but keeps one continuous space key`() {
        val (surface, _) = create()
        val gaps = descendants(surface).filter { it.tag == "split-gap" }
        assertEquals(4, gaps.size)
        assertTrue(gaps.all { it.layoutParams.width > 0 })
        assertEquals(1, descendants(surface).filterIsInstance<KeyboardKeyView>()
            .count { (it.tag as? KeySpec)?.action == KeyAction.SPACE })
    }

    @Test fun `bottom clearance grows for navigation insets and resets without accumulating`() {
        val (surface, _) = create()
        val minimum = (24 * surface.resources.displayMetrics.density).toInt()
        assertEquals(minimum, surface.paddingBottom)
        val inset = minimum + 40
        val insets = android.view.WindowInsets.Builder()
            .setInsets(android.view.WindowInsets.Type.navigationBars(), android.graphics.Insets.of(0, 0, 0, inset))
            .build()
        surface.onApplyWindowInsets(insets)
        surface.onApplyWindowInsets(insets)
        assertEquals(inset, surface.paddingBottom)
        surface.onApplyWindowInsets(android.view.WindowInsets.Builder().build())
        assertEquals(minimum, surface.paddingBottom)
    }

    @Test fun `emoji control opens the native categorized picker`() {
        val (surface, _) = create()
        surface.render(state(KeyboardPage.EMOJI))
        assertEquals(1, descendants(surface).filterIsInstance<EmojiPickerView>().size)
        assertTrue(descendants(surface).filterIsInstance<KeyboardKeyView>().any { it.text.toString() == "ABC" })
    }

    @Test fun `backspace removes a whole emoji or selected text instead of leaving fragments`() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val editor = EditText(activity)
        val connection = editor.onCreateInputConnection(EditorInfo())!!
        for (emoji in listOf("👍🏽", "🇮🇳", "👨‍👩‍👧‍👦", "e\u0301")) {
            editor.setText("x$emoji"); editor.setSelection(editor.length())
            TextEditing.backspace(connection)
            assertEquals("x", editor.text.toString())
        }
        editor.setText("hello"); editor.setSelection(1, 4)
        TextEditing.backspace(connection)
        assertEquals("ho", editor.text.toString())

        // Known collapsed cursor skips the synchronous getSelectedText IPC round-trip.
        var getSelectedCalls = 0
        val spy = object : android.view.inputmethod.InputConnectionWrapper(connection, true) {
            override fun getSelectedText(flags: Int): CharSequence? {
                getSelectedCalls++
                return super.getSelectedText(flags)
            }
        }
        editor.setText("abc\r\n"); editor.setSelection(editor.length())
        TextEditing.backspace(spy, hasSelection = false)
        assertEquals("abc", editor.text.toString())
        TextEditing.backspace(spy, hasSelection = false)
        assertEquals("ab", editor.text.toString())
        assertEquals(0, getSelectedCalls)
    }

    @Test fun `editing keyboard preferences leaves the previously saved credential untouched`() {
        val context = org.robolectric.RuntimeEnvironment.getApplication()
        val prefs = context.getSharedPreferences("keyboard", android.content.Context.MODE_PRIVATE)
        prefs.edit().putString("api_key", "existing:encrypted-value").commit()
        KeyboardSettings(context).apply { haptics = false; previews = false; splitLayout = "off" }
        assertEquals("existing:encrypted-value", prefs.getString("api_key", null))
        assertTrue(KeyboardSettings(context).hasApiKey())
        assertFalse(KeyboardSettings(context).haptics)
        assertEquals("off", KeyboardSettings(context).splitLayout)
    }

    @Test fun `keys have edge-to-edge hit targets, no ripple drawable, and tolerate touch-slop drift`() {
        val (surface, editor) = create()
        val key = key(surface, "a")
        val params = key.layoutParams as android.widget.LinearLayout.LayoutParams
        assertEquals(0, params.leftMargin)
        assertEquals(0, params.topMargin)
        assertEquals(0, params.rightMargin)
        assertEquals(0, params.bottomMargin)
        assertNull("Key background should be canvas-drawn rather than a RippleDrawable", key.background)

        val now = SystemClock.uptimeMillis()
        // Edge tap (1px from corner) with slight drift inside touchSlop still commits on release.
        key.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, 1f, 1f, 0))
        key.dispatchTouchEvent(MotionEvent.obtain(now, now + 20, MotionEvent.ACTION_MOVE, -2f, 1f, 0))
        assertTrue(key.isPressed)
        key.dispatchTouchEvent(MotionEvent.obtain(now, now + 40, MotionEvent.ACTION_UP, -2f, 1f, 0))
        assertEquals("a", editor.text.toString())

        // Dragging well outside touchSlop cancels the tap without inserting.
        key.dispatchTouchEvent(MotionEvent.obtain(now + 100, now + 100, MotionEvent.ACTION_DOWN, 5f, 5f, 0))
        key.dispatchTouchEvent(MotionEvent.obtain(now + 100, now + 120, MotionEvent.ACTION_MOVE, -100f, 5f, 0))
        assertFalse(key.isPressed)
        key.dispatchTouchEvent(MotionEvent.obtain(now + 100, now + 140, MotionEvent.ACTION_UP, -100f, 5f, 0))
        assertEquals("a", editor.text.toString())
    }

    @Test fun `Matte Graphite theme assigns distinct key styles and updates Shift and Mic styles without relayout`() {
        val (surface, _) = create()
        val letter = key(surface, "a")
        val space = key(surface, " ")
        val enter = descendants(surface).filterIsInstance<KeyboardKeyView>()
            .first { (it.tag as? KeySpec)?.action == KeyAction.ENTER }
        val shift = descendants(surface).filterIsInstance<KeyboardKeyView>()
            .first { (it.tag as? KeySpec)?.action == KeyAction.SHIFT }
        val mic = descendants(surface).filterIsInstance<KeyboardKeyView>()
            .first { it.contentDescription == "Start or stop dictation" }

        assertEquals(KeyStyle.LETTER, letter.keyStyle)
        assertEquals(KeyStyle.SPACE, space.keyStyle)
        assertEquals(KeyStyle.ACTION, enter.keyStyle)
        assertEquals(KeyStyle.MODIFIER, shift.keyStyle)
        assertEquals(KeyStyle.MIC, mic.keyStyle)

        surface.updateShift(shifted = true, capsLock = false)
        assertEquals(KeyStyle.MODIFIER_ACTIVE, shift.keyStyle)
        surface.updateShift(shifted = true, capsLock = true)
        assertEquals(KeyStyle.ACTION, shift.keyStyle)
        surface.updateStatus("Listening…", recording = true)
        assertEquals(KeyStyle.MIC_ACTIVE, mic.keyStyle)
        assertFalse(surface.isLayoutRequested)
    }

    @Test fun `inline autofill strip displays chips and restores status when cleared`() {
        val (surface, _) = create()
        val strip = descendants(surface).first { it.contentDescription == "Inline autofill suggestions" }
        assertEquals(View.GONE, strip.visibility)

        val chip = android.widget.TextView(surface.context).apply { text = "user@example.com" }
        surface.addInlineSuggestionView(chip)
        assertEquals(View.VISIBLE, strip.visibility)
        assertTrue(descendants(strip).contains(chip))

        surface.clearInlineSuggestions()
        assertEquals(View.GONE, strip.visibility)
        assertFalse(descendants(strip).contains(chip))
    }
}
