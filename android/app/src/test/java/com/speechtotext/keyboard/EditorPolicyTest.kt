package com.speechtotext.keyboard

import android.text.InputType
import android.view.inputmethod.EditorInfo
import org.junit.Assert.*
import org.junit.Test

class EditorPolicyTest {
    @Test fun `cursor changes cancel dictation even before the first transcript`() {
        assertTrue(EditorPolicy.cursorLeftDictation(3, 3, 9, -1))
        assertTrue(EditorPolicy.cursorLeftDictation(3, 9, 9, 9))
        assertFalse(EditorPolicy.cursorLeftDictation(9, 9, 9, -1))
        assertFalse(EditorPolicy.cursorLeftDictation(12, 12, 9, 12))
    }

    @Test fun `all standard password variations disable voice input`() {
        listOf(InputType.TYPE_TEXT_VARIATION_PASSWORD, InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD).forEach {
            assertTrue(EditorPolicy.isPassword(InputType.TYPE_CLASS_TEXT or it))
        }
        assertTrue(EditorPolicy.isPassword(InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD))
    }

    @Test fun `URL and email fields remain usable with voice and normal typing`() {
        assertFalse(EditorPolicy.isPassword(InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI))
        assertFalse(EditorPolicy.isPassword(InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS))
        assertFalse(EditorPolicy.isNumeric(InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI))
    }

    @Test fun `phone fields select numbers and editor action flags are masked`() {
        assertTrue(EditorPolicy.isNumeric(InputType.TYPE_CLASS_PHONE))
        assertEquals("Search", EditorPolicy.actionLabel(EditorInfo.IME_ACTION_SEARCH or EditorInfo.IME_FLAG_NO_EXTRACT_UI))
        assertEquals("Enter", EditorPolicy.actionLabel(EditorInfo.IME_ACTION_NONE))
    }
}
