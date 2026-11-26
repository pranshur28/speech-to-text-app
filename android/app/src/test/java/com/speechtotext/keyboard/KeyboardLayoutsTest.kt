package com.speechtotext.keyboard

import org.junit.Assert.*
import org.junit.Test

class KeyboardLayoutsTest {
    @Test fun `every ASCII punctuation character is reachable on a symbol page`() {
        val outputs = listOf(KeyboardPage.NUMBERS, KeyboardPage.SYMBOLS, KeyboardPage.MATH)
            .flatMap { KeyboardLayouts.rows(it, false) + KeyboardLayouts.footer(it, "Enter") }.flatMap { it.keys }
            .filter { it.action == KeyAction.TEXT }.map { it.output }.toSet()
        val punctuation = (33..126).map { it.toChar() }.filterNot { it.isLetterOrDigit() }
        punctuation.forEach { assertTrue("Missing symbol: $it", outputs.contains(it.toString())) }
    }

    @Test fun `math page includes comparison operations fractions and calculus symbols`() {
        val outputs = KeyboardLayouts.rows(KeyboardPage.MATH, false).flatMap { it.keys }.map { it.output }.toSet()
        "±×÷≠≈≤≥∞√π∑∏∫∂∈∉∪∩".forEach { assertTrue("Missing math symbol: $it", outputs.contains(it.toString())) }
    }

    @Test fun `symbol page cycle returns to punctuation and always offers letters`() {
        val pages = listOf(KeyboardPage.NUMBERS, KeyboardPage.SYMBOLS, KeyboardPage.MATH)
        pages.forEachIndexed { i, page ->
            val footer = KeyboardLayouts.footer(page, "Enter")
            assertEquals(KeyboardPage.LETTERS, footer.keys.first().page)
            assertEquals(pages[(i + 1) % pages.size], footer.keys[1].page)
        }
    }

    @Test fun `cover portrait stays together while landscape and unfolded widths split`() {
        assertFalse(KeyboardLayouts.shouldSplit(360, false, "auto"))
        assertTrue(KeyboardLayouts.shouldSplit(780, true, "auto"))
        assertTrue(KeyboardLayouts.shouldSplit(700, false, "auto"))
        assertFalse(KeyboardLayouts.shouldSplit(780, true, "off"))
        assertTrue(KeyboardLayouts.gapDp(780) >= 56)
    }

    @Test fun `split footer gives each thumb a working space key`() {
        val footer = KeyboardLayouts.footer(KeyboardPage.LETTERS, "Enter", split = true)
        assertEquals(KeyAction.SPACE, footer.keys[footer.splitAt - 1].action)
        assertEquals(KeyAction.SPACE, footer.keys[footer.splitAt].action)
        assertEquals(" ", footer.keys[footer.splitAt].output)
    }
}
