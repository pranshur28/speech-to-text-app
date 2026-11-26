package com.speechtotext.keyboard

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class WordDictionaryTest {
    @Test fun `built-in dictionary returns ranked prefix suggestions and preserves casing`() {
        val dict = WordDictionary()
        val lower = dict.suggest("hel")
        assertTrue(lower.contains("hello"))
        assertTrue(lower.contains("help"))

        val title = dict.suggest("Hel")
        assertTrue(title.first().startsWith("Hel"))

        val upper = dict.suggest("HEL")
        assertTrue(upper.all { it == it.uppercase() })
    }

    @Test fun `recorded words outrank default suggestions by frequency`() {
        val dict = WordDictionary()
        dict.recordWord("helium", weight = 10)
        val results = dict.suggest("hel")
        assertEquals("helium", results.first())
    }

    @Test fun `imports Gboard personal dictionary txt format including shortcuts and comments`() {
        val sample = """
            # Gboard Dictionary version:1
            omw	On my way!	en-US
            	Kubernetes	en-US
            brb	Be right back	en-US
        """.trimIndent()
        val dict = WordDictionary()
        val result = dict.importStream(ByteArrayInputStream(sample.toByteArray(Charsets.UTF_8)))
        assertEquals(1, result.wordsImported) // Kubernetes is a single word; multi-word phrases become shortcuts
        assertEquals(2, result.shortcutsImported)
        assertEquals("On my way!", dict.suggest("omw").first())
        assertEquals("Be right back", dict.suggest("brb").first())
        assertEquals("Kubernetes", dict.suggest("kube").first())
    }

    @Test fun `imports Gboard personal dictionary zip archive`() {
        val zipBytes = ByteArrayOutputStream().use { baos ->
            ZipOutputStream(baos).use { zip ->
                zip.putNextEntry(ZipEntry("dictionary.txt"))
                zip.write("# Gboard Dictionary version:1\naddr\t123 Main St\ten-US\n\tDeepgram\ten-US\n".toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
            baos.toByteArray()
        }
        val dict = WordDictionary()
        val result = dict.importStream(ByteArrayInputStream(zipBytes))
        assertEquals(1, result.wordsImported)
        assertEquals(1, result.shortcutsImported)
        assertEquals("123 Main St", dict.suggest("addr").first())
        assertEquals("Deepgram", dict.suggest("deep").first())

        dict.clearLearned()
        assertEquals(0, dict.learnedWordCount())
        assertEquals(0, dict.shortcutCount())
    }
}
