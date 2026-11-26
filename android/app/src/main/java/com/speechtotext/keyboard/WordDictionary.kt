package com.speechtotext.keyboard

import android.content.Context
import android.content.SharedPreferences
import java.io.BufferedInputStream
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.util.Locale
import java.util.zip.ZipInputStream

/**
 * Fast, privacy-respecting on-device suggestion dictionary:
 * - Ships with common English words for instant prefix completions.
 * - Learns user word frequencies locally (never called on password fields).
 * - Imports Gboard Personal Dictionary exports (.txt or .zip).
 */
class WordDictionary(private val prefs: SharedPreferences? = null) {
    constructor(context: Context) : this(context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE))

    data class ImportResult(val wordsImported: Int, val shortcutsImported: Int)

    private val learned = LinkedHashMap<String, Int>()
    private val shortcuts = LinkedHashMap<String, String>()

    init {
        loadFromPrefs()
    }

    fun suggest(prefix: String, limit: Int = 3): List<String> {
        val trimmed = prefix.trim()
        if (trimmed.isEmpty() || limit <= 0) return emptyList()
        val lower = trimmed.lowercase(Locale.US)
        val results = ArrayList<String>(limit)
        val seen = HashSet<String>(limit * 2)

        fun addCandidate(word: String, preserveOriginalCase: Boolean = false) {
            if (results.size >= limit) return
            val formatted = if (preserveOriginalCase) word else matchCase(trimmed, word)
            if (seen.add(formatted.lowercase(Locale.US))) {
                results.add(formatted)
            }
        }

        // 1. Exact Gboard shortcut expansion takes top priority.
        shortcuts[lower]?.let { addCandidate(it, preserveOriginalCase = true) }

        // 2. Learned / imported user words matching prefix, ranked by frequency then exactness.
        if (results.size < limit && learned.isNotEmpty()) {
            val matches = learned.entries
                .asSequence()
                .filter { it.key.lowercase(Locale.US).startsWith(lower) }
                .sortedWith(
                    compareByDescending<Map.Entry<String, Int>> { it.key.equals(lower, ignoreCase = true) }
                        .thenByDescending { it.value }
                        .thenBy { it.key.length }
                )
            for (entry in matches) {
                if (results.size >= limit) break
                val hasCustomCase = entry.key.any { it.isUpperCase() }
                addCandidate(entry.key, preserveOriginalCase = hasCustomCase)
            }
        }

        // 3. Built-in common English word list (ordered roughly by everyday frequency).
        if (results.size < limit) {
            for (word in COMMON_WORDS) {
                if (results.size >= limit) break
                if (word.startsWith(lower)) {
                    addCandidate(word)
                }
            }
        }

        return results
    }

    fun recordWord(rawWord: String, weight: Int = 1) {
        val word = rawWord.trim()
        if (!isValidWord(word)) return
        val existingKey = learned.keys.firstOrNull { it.equals(word, ignoreCase = true) }
        val key = existingKey ?: word
        learned[key] = (learned[key] ?: 0) + weight
        trimLearnedIfNeeded()
        persistWords()
    }

    fun addShortcut(shortcut: String, expansion: String) {
        val key = shortcut.trim().lowercase(Locale.US)
        val value = expansion.trim()
        if (key.isEmpty() || value.isEmpty() || key.length > 32 || value.length > 120) return
        shortcuts[key] = value
        persistShortcuts()
    }

    /**
     * Import a Gboard Personal Dictionary export stream (either a .txt file or a .zip archive
     * containing .txt files). Lines follow Gboard's format: `shortcut\tword\tlocale`.
     */
    fun importStream(stream: InputStream): ImportResult {
        val buffered = BufferedInputStream(stream)
        buffered.mark(4)
        val header = ByteArray(2)
        val read = buffered.read(header)
        buffered.reset()

        var words = 0
        var addedShortcuts = 0
        if (read == 2 && header[0] == 0x50.toByte() && header[1] == 0x4B.toByte()) {
            ZipInputStream(buffered).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory && entry.name.endsWith(".txt", ignoreCase = true)) {
                        val reader = BufferedReader(InputStreamReader(zip, Charsets.UTF_8))
                        val partial = parseGboardLines(reader.lineSequence())
                        words += partial.wordsImported
                        addedShortcuts += partial.shortcutsImported
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
        } else {
            BufferedReader(InputStreamReader(buffered, Charsets.UTF_8)).use { reader ->
                val partial = parseGboardLines(reader.lineSequence())
                words += partial.wordsImported
                addedShortcuts += partial.shortcutsImported
            }
        }
        trimLearnedIfNeeded()
        persistWords()
        persistShortcuts()
        return ImportResult(words, addedShortcuts)
    }

    fun parseGboardLines(lines: Sequence<String>): ImportResult {
        var words = 0
        var addedShortcuts = 0
        for (rawLine in lines) {
            val line = rawLine.trimEnd('\r', '\n')
            if (line.isBlank() || line.startsWith("#")) continue
            val parts = line.split('\t')
            if (parts.size >= 2) {
                val shortcut = parts[0].trim()
                val word = parts[1].trim()
                if (word.isNotEmpty() && word.length <= 80) {
                    if (isValidWord(word)) {
                        val existingKey = learned.keys.firstOrNull { it.equals(word, ignoreCase = true) }
                        val key = existingKey ?: word
                        learned[key] = maxOf(learned[key] ?: 0, 5)
                        words++
                    }
                    if (shortcut.isNotEmpty() && shortcut.length <= 32) {
                        shortcuts[shortcut.lowercase(Locale.US)] = word
                        addedShortcuts++
                    }
                }
            } else {
                val single = line.trim()
                if (isValidWord(single)) {
                    val existingKey = learned.keys.firstOrNull { it.equals(single, ignoreCase = true) }
                    val key = existingKey ?: single
                    learned[key] = maxOf(learned[key] ?: 0, 5)
                    words++
                }
            }
        }
        return ImportResult(words, addedShortcuts)
    }

    fun learnedWordCount(): Int = learned.size
    fun shortcutCount(): Int = shortcuts.size

    fun clearLearned() {
        learned.clear()
        shortcuts.clear()
        prefs?.edit()?.remove(KEY_WORDS)?.remove(KEY_SHORTCUTS)?.apply()
    }

    private fun isValidWord(word: String): Boolean =
        word.length in 2..40 && word.any { it.isLetter() } &&
            word.all { it.isLetterOrDigit() || it == '\'' || it == '-' || it == '_' }

    private fun matchCase(prefix: String, candidate: String): String = when {
        prefix.length >= 2 && prefix.all { !it.isLetter() || it.isUpperCase() } -> candidate.uppercase(Locale.US)
        prefix[0].isUpperCase() -> candidate.replaceFirstChar { it.uppercase(Locale.US) }
        else -> candidate
    }

    private fun trimLearnedIfNeeded() {
        if (learned.size <= MAX_LEARNED) return
        val kept = learned.entries
            .sortedByDescending { it.value }
            .take(MAX_LEARNED)
        learned.clear()
        for ((k, v) in kept) learned[k] = v
    }

    private fun loadFromPrefs() {
        val store = prefs ?: return
        store.getString(KEY_WORDS, null)?.lineSequence()?.forEach { line ->
            val sep = line.lastIndexOf('\t')
            if (sep > 0) {
                val word = line.substring(0, sep)
                val count = line.substring(sep + 1).toIntOrNull() ?: 1
                if (word.isNotEmpty()) learned[word] = count
            }
        }
        store.getString(KEY_SHORTCUTS, null)?.lineSequence()?.forEach { line ->
            val sep = line.indexOf('\t')
            if (sep > 0) {
                val key = line.substring(0, sep)
                val value = line.substring(sep + 1)
                if (key.isNotEmpty() && value.isNotEmpty()) shortcuts[key] = value
            }
        }
    }

    private fun persistWords() {
        val store = prefs ?: return
        val serialized = learned.entries.joinToString("\n") { "${it.key}\t${it.value}" }
        store.edit().putString(KEY_WORDS, serialized).apply()
    }

    private fun persistShortcuts() {
        val store = prefs ?: return
        val serialized = shortcuts.entries.joinToString("\n") { "${it.key}\t${it.value}" }
        store.edit().putString(KEY_SHORTCUTS, serialized).apply()
    }

    companion object {
        private const val PREFS_NAME = "word_dictionary"
        private const val KEY_WORDS = "learned_words"
        private const val KEY_SHORTCUTS = "shortcuts"
        private const val MAX_LEARNED = 2000

        private val COMMON_WORDS = listOf(
            "the", "that", "this", "there", "their", "they", "them", "then", "than", "thank", "thanks", "think", "thing", "things", "through", "though", "thought",
            "and", "are", "about", "after", "again", "all", "also", "always", "already", "almost", "around", "another", "anyone", "anything", "available", "actually", "app", "android",
            "you", "your", "yours", "yourself", "yeah", "yes", "yesterday", "yet",
            "for", "from", "first", "find", "feel", "free", "few", "friend", "friends", "friday", "family", "finish", "finished", "fix", "fixed", "file", "files", "folder",
            "with", "will", "would", "what", "when", "where", "which", "while", "who", "why", "want", "work", "working", "works", "wait", "waiting", "week", "weekend", "welcome", "well", "went", "were", "without", "write", "wrong",
            "have", "has", "had", "here", "hello", "hey", "help", "home", "hope", "hour", "hours", "house", "how", "however", "happy", "hear", "heard",
            "not", "now", "need", "needs", "needed", "new", "next", "never", "nice", "night", "nothing", "number", "note", "notes",
            "can", "could", "come", "coming", "call", "calling", "check", "checking", "change", "changes", "clear", "close", "code", "commit", "complete", "confirm", "continue", "cool", "copy", "create",
            "but", "been", "being", "back", "best", "better", "before", "because", "between", "both", "bring", "build", "busy", "button",
            "out", "our", "one", "only", "over", "other", "open", "okay", "ok", "often", "once", "order", "office", "online", "option", "options",
            "just", "join", "job", "jump",
            "like", "look", "looking", "looks", "let", "last", "later", "late", "leave", "left", "life", "line", "link", "list", "little", "live", "local", "long", "love", "lunch",
            "get", "getting", "got", "going", "good", "great", "give", "given", "glad", "github", "google", "group", "guess",
            "make", "making", "made", "more", "most", "much", "many", "maybe", "mean", "meet", "meeting", "message", "might", "minute", "minutes", "miss", "mobile", "model", "moment", "monday", "money", "month", "morning", "move", "must",
            "know", "knew", "keep", "keeping", "key", "keyboard", "kind",
            "time", "today", "tomorrow", "tonight", "take", "taking", "talk", "talking", "team", "tell", "test", "testing", "text", "told", "together", "trying", "try", "tuesday", "turn", "type", "typing",
            "see", "seen", "say", "said", "saying", "same", "save", "saved", "schedule", "screen", "search", "second", "send", "sending", "sent", "service", "set", "settings", "share", "she", "should", "show", "since", "small", "some", "someone", "something", "sometimes", "soon", "sorry", "sound", "space", "speak", "speech", "start", "started", "state", "status", "stay", "still", "stop", "store", "stuff", "sure", "switch", "sync", "system",
            "people", "person", "phone", "photo", "pick", "place", "plan", "play", "please", "point", "possible", "post", "press", "pretty", "price", "print", "privacy", "probably", "problem", "project", "pull", "push", "put",
            "really", "ready", "read", "reading", "reason", "receive", "recent", "record", "recording", "remember", "remove", "reply", "report", "repo", "repository", "request", "reset", "response", "rest", "result", "results", "return", "review", "right", "room", "run", "running",
            "don't", "doesn't", "didn't", "can't", "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "i'm", "i'll", "i've", "i'd", "it's", "that's", "there's", "what's", "let's", "we're", "we'll", "you're", "you'll", "you've", "they're",
            "very", "version", "video", "view", "visit", "voice",
            "use", "used", "user", "using", "usually", "update", "updated", "upload", "uploaded", "until", "under", "understand",
            "email", "enable", "enabled", "end", "enough", "enter", "error", "even", "evening", "ever", "every", "everyone", "everything", "exact", "exactly", "example", "excited", "expected", "export",
            "into", "idea", "important", "import", "imported", "improve", "include", "info", "information", "input", "install", "installed", "instead", "interest", "internet", "issue", "issues", "item",
            "down", "doing", "done", "does", "did", "day", "days", "date", "data", "deal", "december", "deepgram", "default", "delete", "deploy", "design", "desktop", "detail", "details", "device", "dictionary", "different", "dinner", "direct", "directly", "disable", "display", "document", "download", "draft", "drive", "drop", "during",
            "quick", "quickly", "question", "questions", "quite", "quiet",
            "zero", "zone", "zoom", "zip",
        )
    }
}
