package com.speechtotext.keyboard

import android.text.InputType
import android.view.inputmethod.EditorInfo

object EditorPolicy {
    fun cursorLeftDictation(newStart: Int, newEnd: Int, expectedEnd: Int, composingEnd: Int): Boolean =
        newStart != newEnd || (expectedEnd >= 0 && newEnd != expectedEnd && newEnd != composingEnd)

    fun isPassword(inputType: Int): Boolean {
        val type = inputType and InputType.TYPE_MASK_CLASS
        val variation = inputType and InputType.TYPE_MASK_VARIATION
        return (type == InputType.TYPE_CLASS_TEXT && variation in setOf(
            InputType.TYPE_TEXT_VARIATION_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
        )) || (type == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD)
    }

    fun isNumeric(inputType: Int): Boolean = (inputType and InputType.TYPE_MASK_CLASS) in
        setOf(InputType.TYPE_CLASS_NUMBER, InputType.TYPE_CLASS_PHONE, InputType.TYPE_CLASS_DATETIME)

    fun actionLabel(imeOptions: Int): String = when (imeOptions and EditorInfo.IME_MASK_ACTION) {
        EditorInfo.IME_ACTION_GO -> "Go"
        EditorInfo.IME_ACTION_SEARCH -> "Search"
        EditorInfo.IME_ACTION_SEND -> "Send"
        EditorInfo.IME_ACTION_NEXT -> "Next"
        EditorInfo.IME_ACTION_DONE -> "Done"
        EditorInfo.IME_ACTION_PREVIOUS -> "Previous"
        else -> "Enter"
    }
}
