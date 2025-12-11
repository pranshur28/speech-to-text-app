import Database from 'better-sqlite3';
import log from '../utils/logger';

export interface DictionaryEntry {
  id: number;
  spoken_phrase: string;
  replacement: string;
  is_case_sensitive: number;
  is_enabled: number;
  created_at: number;
  updated_at: number;
}

export interface DictionaryEntryInsert {
  spoken_phrase: string;
  replacement: string;
  is_case_sensitive?: boolean;
}

export class DictionaryService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // Create a new dictionary entry
  addEntry(data: DictionaryEntryInsert): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO dictionary_entries (spoken_phrase, replacement, is_case_sensitive, is_enabled, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `);

    const result = stmt.run(
      data.spoken_phrase,
      data.replacement,
      data.is_case_sensitive ? 1 : 0,
      now,
      now
    );

    log.info(`[DictionaryService] Added entry #${result.lastInsertRowid}: "${data.spoken_phrase}" → "${data.replacement}"`);
    return result.lastInsertRowid as number;
  }

  // Get all dictionary entries (for settings UI)
  getAllEntries(): DictionaryEntry[] {
    return this.db.prepare('SELECT * FROM dictionary_entries ORDER BY spoken_phrase ASC').all() as DictionaryEntry[];
  }

  // Get only enabled entries for text processing, ordered by phrase length (longest first)
  // This prevents partial matches - e.g., "Kleene Star closure" won't match just "Kleene Star"
  getEnabledEntries(): DictionaryEntry[] {
    return this.db.prepare(
      'SELECT * FROM dictionary_entries WHERE is_enabled = 1 ORDER BY LENGTH(spoken_phrase) DESC'
    ).all() as DictionaryEntry[];
  }

  // Get a single entry by ID
  getEntry(id: number): DictionaryEntry | null {
    const result = this.db.prepare('SELECT * FROM dictionary_entries WHERE id = ?').get(id) as DictionaryEntry | undefined;
    return result || null;
  }

  // Update an existing entry
  updateEntry(id: number, updates: Partial<DictionaryEntryInsert> & { is_enabled?: boolean }): void {
    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.spoken_phrase !== undefined) {
      fields.push('spoken_phrase = ?');
      params.push(updates.spoken_phrase);
    }
    if (updates.replacement !== undefined) {
      fields.push('replacement = ?');
      params.push(updates.replacement);
    }
    if (updates.is_case_sensitive !== undefined) {
      fields.push('is_case_sensitive = ?');
      params.push(updates.is_case_sensitive ? 1 : 0);
    }
    if (updates.is_enabled !== undefined) {
      fields.push('is_enabled = ?');
      params.push(updates.is_enabled ? 1 : 0);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    this.db.prepare(`UPDATE dictionary_entries SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    log.info(`[DictionaryService] Updated entry #${id}`);
  }

  // Delete an entry
  deleteEntry(id: number): void {
    this.db.prepare('DELETE FROM dictionary_entries WHERE id = ?').run(id);
    log.info(`[DictionaryService] Deleted entry #${id}`);
  }

  // Toggle enabled/disabled status
  toggleEnabled(id: number): void {
    this.db.prepare(
      'UPDATE dictionary_entries SET is_enabled = NOT is_enabled, updated_at = ? WHERE id = ?'
    ).run(Date.now(), id);
    log.info(`[DictionaryService] Toggled enabled for entry #${id}`);
  }

  // Apply all enabled dictionary replacements to text
  // This is the core function called after GPT formatting
  applyReplacements(text: string): string {
    const entries = this.getEnabledEntries();
    let result = text;

    for (const entry of entries) {
      if (entry.is_case_sensitive) {
        // Case-sensitive: simple string split and join
        result = result.split(entry.spoken_phrase).join(entry.replacement);
      } else {
        // Case-insensitive: use regex with 'gi' flags
        const regex = new RegExp(this.escapeRegex(entry.spoken_phrase), 'gi');
        result = result.replace(regex, entry.replacement);
      }
    }

    return result;
  }

  // Escape special regex characters in a string
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Get statistics about dictionary entries
  getStats(): { total: number; enabled: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM dictionary_entries').get() as { count: number }).count;
    const enabled = (this.db.prepare('SELECT COUNT(*) as count FROM dictionary_entries WHERE is_enabled = 1').get() as { count: number }).count;
    return { total, enabled };
  }
}
