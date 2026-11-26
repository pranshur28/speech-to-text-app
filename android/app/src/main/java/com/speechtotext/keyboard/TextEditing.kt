package com.speechtotext.keyboard

import android.icu.text.BreakIterator
import android.view.inputmethod.InputConnection
import java.util.Locale

object TextEditing {
    /** Delete a selected range or a whole grapheme, including emoji modifiers/ZWJ sequences. */
    fun backspace(connection: InputConnection) {
        if (!connection.getSelectedText(0).isNullOrEmpty()) {
            connection.commitText("", 1)
            return
        }
        val before = connection.getTextBeforeCursor(128, 0)?.toString().orEmpty()
        if (before.isEmpty()) return
        val boundaries = BreakIterator.getCharacterInstance(Locale.ROOT).apply { setText(before) }
        val previous = boundaries.preceding(before.length)
        val count = if (previous == BreakIterator.DONE) before.length else before.length - previous
        connection.deleteSurroundingText(count, 0)
    }
}
