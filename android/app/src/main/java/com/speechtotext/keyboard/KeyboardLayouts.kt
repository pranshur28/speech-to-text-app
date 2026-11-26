package com.speechtotext.keyboard

enum class KeyboardPage { LETTERS, NUMBERS, SYMBOLS, MATH, EMOJI }
enum class KeyAction { TEXT, SHIFT, DELETE, PAGE, EMOJI, SPACE, ENTER }
data class KeySpec(
    val label: String,
    val action: KeyAction = KeyAction.TEXT,
    val output: String = label,
    val weight: Float = 1f,
    val alternate: String? = null,
    val page: KeyboardPage? = null,
)
data class KeyRow(val keys: List<KeySpec>, val splitAt: Int = keys.size / 2)

/** Explicit key inventories: visible labels and inserted Unicode strings share one source. */
object KeyboardLayouts {
    private val alternates = mapOf(
        'q' to "1", 'w' to "2", 'e' to "3", 'r' to "4", 't' to "5", 'y' to "6", 'u' to "7", 'i' to "8", 'o' to "9", 'p' to "0",
        'a' to "@", 's' to "#", 'd' to "$", 'f' to "%", 'g' to "&", 'h' to "-", 'j' to "+", 'k' to "(", 'l' to ")",
        'z' to "*", 'x' to "\"", 'c' to "'", 'v' to ":", 'b' to ";", 'n' to "!", 'm' to "?",
    )
    val numberRows = listOf("1234567890", "@#\$%&-+()/", "_\"':;!?=\\|", "*`^{}[]<>")
    val symbolRows = listOf("€£¥¢₹₩₽$%‰", "©®™§¶•…–—°", "¹²³½¼¾¿¡‽~", "‘’“”«»‹›·")
    val mathRows = listOf("+−×÷=≠≈±∓∞", "<>≤≥√∛∜πθΩ", "∑∏∫∂∆∇∈∉∅∝", "∪∩⊂⊆∧∨¬⇒⇔")

    fun rows(page: KeyboardPage, uppercase: Boolean): List<KeyRow> {
        if (page == KeyboardPage.EMOJI) return emptyList()
        if (page == KeyboardPage.LETTERS) {
            fun letters(value: String) = value.map {
                KeySpec(if (uppercase) it.uppercase() else it.toString(), alternate = alternates[it])
            }
            return listOf(
                KeyRow("1234567890".map { KeySpec(it.toString()) }),
                KeyRow(letters("qwertyuiop")),
                KeyRow(letters("asdfghjkl"), 5),
                KeyRow(listOf(KeySpec("⇧", KeyAction.SHIFT, weight = 1.5f)) + letters("zxcvbnm") +
                    KeySpec("⌫", KeyAction.DELETE, weight = 1.5f), 5),
            )
        }
        val rows = when (page) {
            KeyboardPage.NUMBERS -> numberRows
            KeyboardPage.SYMBOLS -> symbolRows
            else -> mathRows
        }
        return rows.mapIndexed { index, row ->
            KeyRow(row.map { KeySpec(it.toString()) } +
                if (index == rows.lastIndex) listOf(KeySpec("⌫", KeyAction.DELETE)) else emptyList())
        }
    }

    fun footer(page: KeyboardPage, enter: String, split: Boolean = false): KeyRow {
        val keys = mutableListOf<KeySpec>()
        keys += KeySpec(if (page == KeyboardPage.LETTERS) "?123" else "ABC", KeyAction.PAGE, weight = 1.4f,
            page = if (page == KeyboardPage.LETTERS) KeyboardPage.NUMBERS else KeyboardPage.LETTERS)
        if (page != KeyboardPage.LETTERS && page != KeyboardPage.EMOJI) {
            val next = when (page) { KeyboardPage.NUMBERS -> KeyboardPage.SYMBOLS; KeyboardPage.SYMBOLS -> KeyboardPage.MATH; else -> KeyboardPage.NUMBERS }
            keys += KeySpec(when (next) { KeyboardPage.SYMBOLS -> "#+="; KeyboardPage.MATH -> "Math"; else -> "?123" }, KeyAction.PAGE, page = next, weight = 1.3f)
        }
        keys += if (page == KeyboardPage.EMOJI) KeySpec("⌫", KeyAction.DELETE)
            else KeySpec("☺", KeyAction.EMOJI)
        keys += KeySpec(",", weight = 0.8f, alternate = "_")
        keys += KeySpec("space", KeyAction.SPACE, output = " ", weight = 3.6f)
        keys += KeySpec(".", weight = 0.8f, alternate = "…")
        keys += KeySpec(enter, KeyAction.ENTER, weight = 1.6f)
        val spaceIndex = keys.indexOfFirst { it.action == KeyAction.SPACE }
        if (split) {
            val left = keys.take(spaceIndex) + KeySpec("space", KeyAction.SPACE, output = " ", weight = 2.2f)
            val right = listOf(KeySpec("space", KeyAction.SPACE, output = " ", weight = 2.2f)) + keys.drop(spaceIndex + 1)
            return KeyRow(left + right, left.size)
        }
        return KeyRow(keys, spaceIndex + 1)
    }

    fun shouldSplit(widthDp: Int, landscape: Boolean, preference: String): Boolean = when (preference) {
        "off" -> false
        "on" -> widthDp >= 480
        else -> widthDp >= 600 || (landscape && widthDp >= 480)
    }
    fun gapDp(widthDp: Int) = (widthDp * 0.13f).toInt().coerceIn(56, 144)
}
