package com.speechtotext.keyboard

import android.icu.text.BreakIterator
import android.view.inputmethod.InputConnection
import java.util.Locale

object TextEditing {
    private const val LOOKBACK_CHARS = 32
    private val breakIterator = ThreadLocal.withInitial { BreakIterator.getCharacterInstance(Locale.ROOT) }

    /**
     * Delete a selected range or a whole grapheme, including emoji modifiers/ZWJ sequences.
     * Passing a known [hasSelection] avoids an extra synchronous Binder IPC round-trip.
     */
    fun backspace(connection: InputConnection, hasSelection: Boolean? = null) {
        val selected = hasSelection ?: !connection.getSelectedText(0).isNullOrEmpty()
        if (selected) {
            connection.commitText("", 1)
            return
        }
        val before = connection.getTextBeforeCursor(LOOKBACK_CHARS, 0)?.toString().orEmpty()
        if (before.isEmpty()) return
        connection.deleteSurroundingText(trailingGraphemeLength(before), 0)
    }

    internal fun trailingGraphemeLength(text: String): Int {
        val length = text.length
        if (length == 0) return 0
        val last = text[length - 1]
        if (last.code < 0x80 && (length == 1 || text[length - 2].code < 0x80)) {
            return if (last == '\n' && length >= 2 && text[length - 2] == '\r') 2 else 1
        }
        val boundaries = breakIterator.get() ?: BreakIterator.getCharacterInstance(Locale.ROOT)
        boundaries.setText(text)
        val previous = boundaries.preceding(length)
        return if (previous == BreakIterator.DONE) length else length - previous
    }
}
