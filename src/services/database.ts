import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from '../utils/logger';

export interface Transcription {
  id: number;
  raw_text: string;
  formatted_text: string;
  timestamp: number;
  formatting_profile: string;
  is_favorite: number;
  created_at: number;
}

export interface TranscriptionInsert {
  raw_text: string;
  formatted_text: string;
  timestamp: number;
  formatting_profile?: string;
  is_favorite?: number;
}

export interface TranscriptionFilters {
  query?: string;
  startDate?: number;
  endDate?: number;
  isFavorite?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Turn free text typed by the user into a safe FTS5 MATCH expression.
 * Each word is quoted as a literal phrase (so characters like " - ( * : can't cause syntax
 * errors), and words are implicitly ANDed. Returns '' when there is nothing to match.
 */
export function toFtsQuery(input: string): string {
  return (input || '')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(' ');
}

export class DatabaseService {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Create database directory if it doesn't exist
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'data');

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, 'transcriptions.db');

    // Initialize database
    this.db = new Database(this.dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    this.migrate();

    log.info(`[DatabaseService] Initialized at ${this.dbPath}`);
  }

  private migrate(): void {
    let version = this.getSchemaVersion();

    if (version < 1) {
      log.info('[DatabaseService] Running initial migration...');

      // Main transcriptions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          raw_text TEXT NOT NULL,
          formatted_text TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          formatting_profile TEXT DEFAULT 'casual',
          is_favorite INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- Full-text search index (FTS5)
        CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
          raw_text,
          formatted_text,
          content='transcriptions',
          content_rowid='id'
        );

        -- Triggers to keep FTS index in sync
        CREATE TRIGGER IF NOT EXISTS transcriptions_ai AFTER INSERT ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(rowid, raw_text, formatted_text)
          VALUES (new.id, new.raw_text, new.formatted_text);
        END;

        CREATE TRIGGER IF NOT EXISTS transcriptions_ad AFTER DELETE ON transcriptions BEGIN
          DELETE FROM transcriptions_fts WHERE rowid = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS transcriptions_au AFTER UPDATE ON transcriptions BEGIN
          UPDATE transcriptions_fts SET raw_text = new.raw_text, formatted_text = new.formatted_text
          WHERE rowid = old.id;
        END;

        -- Tags table
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#6366f1',
          use_count INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- Note-Tag junction table
        CREATE TABLE IF NOT EXISTS note_tags (
          note_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        -- Formatting profiles table
        CREATE TABLE IF NOT EXISTS formatting_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          icon TEXT,
          system_prompt TEXT NOT NULL,
          is_builtin INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- Paste history table
        CREATE TABLE IF NOT EXISTS paste_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transcription_id INTEGER NOT NULL,
          pasted_at INTEGER NOT NULL,
          FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_timestamp ON transcriptions(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_favorite ON transcriptions(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_created_at ON transcriptions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_tags_count ON tags(use_count DESC);

        -- Schema version table
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        );

        INSERT INTO schema_version (version) VALUES (1);
      `);

      version = 1;
      log.info('[DatabaseService] Migration complete. Schema version: 1');
    }

    // Version 2: custom dictionary entries
    if (version < 2) {
      log.info('[DatabaseService] Running migration to version 2...');

      this.db.exec(`
        -- Custom dictionary entries table for user-defined replacements
        CREATE TABLE IF NOT EXISTS dictionary_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spoken_phrase TEXT NOT NULL UNIQUE,
          replacement TEXT NOT NULL,
          is_case_sensitive INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Index for fast lookup during text processing
        CREATE INDEX IF NOT EXISTS idx_dictionary_spoken ON dictionary_entries(spoken_phrase);
        CREATE INDEX IF NOT EXISTS idx_dictionary_enabled ON dictionary_entries(is_enabled);

        UPDATE schema_version SET version = 2;
      `);

      version = 2;
      log.info('[DatabaseService] Migration complete. Schema version: 2');
    }

    // Version 3: correct FTS sync triggers. An external-content FTS5 table must be told which
    // old values to remove via the special 'delete' command; plain DELETE/UPDATE on it leaves
    // stale entries behind. Rebuild the index from the source table afterwards.
    if (version < 3) {
      log.info('[DatabaseService] Running migration to version 3...');

      this.db.transaction(() => {
        this.db.exec(`
          DROP TRIGGER IF EXISTS transcriptions_ad;
          DROP TRIGGER IF EXISTS transcriptions_au;

          CREATE TRIGGER transcriptions_ad AFTER DELETE ON transcriptions BEGIN
            INSERT INTO transcriptions_fts(transcriptions_fts, rowid, raw_text, formatted_text)
            VALUES ('delete', old.id, old.raw_text, old.formatted_text);
          END;

          CREATE TRIGGER transcriptions_au AFTER UPDATE ON transcriptions BEGIN
            INSERT INTO transcriptions_fts(transcriptions_fts, rowid, raw_text, formatted_text)
            VALUES ('delete', old.id, old.raw_text, old.formatted_text);
            INSERT INTO transcriptions_fts(rowid, raw_text, formatted_text)
            VALUES (new.id, new.raw_text, new.formatted_text);
          END;

          INSERT INTO transcriptions_fts(transcriptions_fts) VALUES ('rebuild');

          UPDATE schema_version SET version = 3;
        `);
      })();

      version = 3;
      log.info('[DatabaseService] Migration complete. Schema version: 3');
    }
  }

  private getSchemaVersion(): number {
    try {
      const result = this.db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
      return result?.version || 0;
    } catch (error) {
      return 0;
    }
  }

  // CRUD Operations

  saveTranscription(data: TranscriptionInsert): number {
    const now = Date.now();

    const insert = this.db.prepare(`
      INSERT INTO transcriptions (raw_text, formatted_text, timestamp, formatting_profile, is_favorite, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      data.raw_text,
      data.formatted_text,
      data.timestamp,
      data.formatting_profile || 'casual',
      data.is_favorite || 0,
      now
    );

    log.info(`[DatabaseService] Saved transcription #${result.lastInsertRowid}`);
    return result.lastInsertRowid as number;
  }

  getTranscription(id: number): Transcription | null {
    const query = this.db.prepare('SELECT * FROM transcriptions WHERE id = ?');
    const result = query.get(id) as Transcription | undefined;
    return result || null;
  }

  getTranscriptions(filters: TranscriptionFilters = {}): Transcription[] {
    const where = this.buildFilterClause(filters);
    const page = this.buildPagination(filters);
    return this.db
      .prepare(`SELECT t.* FROM transcriptions t WHERE 1=1${where.sql} ORDER BY t.timestamp DESC${page.sql}`)
      .all(...where.params, ...page.params) as Transcription[];
  }

  countTranscriptions(filters: TranscriptionFilters = {}): number {
    const where = this.buildFilterClause(filters);
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM transcriptions t WHERE 1=1${where.sql}`)
      .get(...where.params) as { count: number };
    return row.count;
  }

  searchTranscriptions(searchQuery: string, filters: TranscriptionFilters = {}): Transcription[] {
    const match = toFtsQuery(searchQuery);
    if (!match) {
      return this.getTranscriptions(filters);
    }

    const where = this.buildFilterClause(filters);
    const page = this.buildPagination(filters);
    return this.db
      .prepare(`
        SELECT t.*, rank
        FROM transcriptions t
        JOIN transcriptions_fts fts ON t.id = fts.rowid
        WHERE transcriptions_fts MATCH ?${where.sql}
        ORDER BY rank, t.timestamp DESC${page.sql}
      `)
      .all(match, ...where.params, ...page.params) as Transcription[];
  }

  countSearchResults(searchQuery: string, filters: TranscriptionFilters = {}): number {
    const match = toFtsQuery(searchQuery);
    if (!match) {
      return this.countTranscriptions(filters);
    }

    const where = this.buildFilterClause(filters);
    const row = this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM transcriptions t
        JOIN transcriptions_fts fts ON t.id = fts.rowid
        WHERE transcriptions_fts MATCH ?${where.sql}
      `)
      .get(match, ...where.params) as { count: number };
    return row.count;
  }

  // WHERE conditions shared by listing, searching and counting (table alias "t")
  private buildFilterClause(filters: TranscriptionFilters): { sql: string; params: any[] } {
    let sql = '';
    const params: any[] = [];

    if (filters.isFavorite !== undefined) {
      sql += ' AND t.is_favorite = ?';
      params.push(filters.isFavorite ? 1 : 0);
    }

    if (filters.startDate) {
      sql += ' AND t.timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND t.timestamp <= ?';
      params.push(filters.endDate);
    }

    if (filters.tags && filters.tags.length > 0) {
      sql += ` AND t.id IN (
        SELECT DISTINCT note_id FROM note_tags
        WHERE tag_id IN (
          SELECT id FROM tags WHERE name IN (${filters.tags.map(() => '?').join(',')})
        )
      )`;
      params.push(...filters.tags);
    }

    return { sql, params };
  }

  private buildPagination(filters: TranscriptionFilters): { sql: string; params: any[] } {
    let sql = '';
    const params: any[] = [];

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      // SQLite requires LIMIT before OFFSET; -1 means no limit
      if (!filters.limit) sql += ' LIMIT -1';
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return { sql, params };
  }

  updateTranscription(id: number, updates: Partial<TranscriptionInsert>): void {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.formatted_text !== undefined) {
      fields.push('formatted_text = ?');
      params.push(updates.formatted_text);
    }

    if (updates.formatting_profile !== undefined) {
      fields.push('formatting_profile = ?');
      params.push(updates.formatting_profile);
    }

    if (updates.is_favorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(updates.is_favorite);
    }

    if (fields.length === 0) {
      return;
    }

    params.push(id);
    const query = `UPDATE transcriptions SET ${fields.join(', ')} WHERE id = ?`;

    this.db.prepare(query).run(...params);
    log.info(`[DatabaseService] Updated transcription #${id}`);
  }

  deleteTranscription(id: number): void {
    this.db.prepare('DELETE FROM transcriptions WHERE id = ?').run(id);
    log.info(`[DatabaseService] Deleted transcription #${id}`);
  }

  toggleFavorite(id: number): void {
    this.db.prepare('UPDATE transcriptions SET is_favorite = NOT is_favorite WHERE id = ?').run(id);
    log.info(`[DatabaseService] Toggled favorite for transcription #${id}`);
  }

  // Export functionality

  exportTranscriptions(ids: number[], format: 'json' | 'markdown' | 'txt'): string {
    const transcriptions = this.db.prepare(`
      SELECT * FROM transcriptions WHERE id IN (${ids.map(() => '?').join(',')})
      ORDER BY timestamp ASC
    `).all(...ids) as Transcription[];

    switch (format) {
      case 'json':
        return JSON.stringify(transcriptions, null, 2);

      case 'markdown':
        return transcriptions.map(t => {
          const date = new Date(t.timestamp).toLocaleString();
          return `# ${date}\n\n${t.formatted_text}\n\n---\n`;
        }).join('\n');

      case 'txt':
        return transcriptions.map(t => {
          const date = new Date(t.timestamp).toLocaleString();
          return `${date}\n${t.formatted_text}\n\n${'='.repeat(50)}\n`;
        }).join('\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Backup and recovery

  backup(): void {
    const backupPath = `${this.dbPath}.bak`;

    try {
      // Copy database file
      fs.copyFileSync(this.dbPath, backupPath);
      log.info(`[DatabaseService] Backup created at ${backupPath}`);
    } catch (error) {
      log.error('[DatabaseService] Backup failed:', error);
    }
  }

  restore(): boolean {
    const backupPath = `${this.dbPath}.bak`;

    if (!fs.existsSync(backupPath)) {
      log.error('[DatabaseService] No backup found');
      return false;
    }

    try {
      this.close();
      fs.copyFileSync(backupPath, this.dbPath);
      this.db = new Database(this.dbPath);
      this.db.pragma('foreign_keys = ON');
      log.info('[DatabaseService] Restored from backup');
      return true;
    } catch (error) {
      log.error('[DatabaseService] Restore failed:', error);
      return false;
    }
  }

  // Statistics

  getStats(): { total: number; favorites: number; totalTags: number } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM transcriptions').get() as { count: number };
    const favorites = this.db.prepare('SELECT COUNT(*) as count FROM transcriptions WHERE is_favorite = 1').get() as { count: number };
    const totalTags = this.db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };

    return {
      total: total.count,
      favorites: favorites.count,
      totalTags: totalTags.count
    };
  }

  // Database access for other services

  getDb(): Database.Database {
    return this.db;
  }

  // Cleanup

  vacuum(): void {
    log.info('[DatabaseService] Running VACUUM...');
    this.db.exec('VACUUM');
    log.info('[DatabaseService] VACUUM complete');
  }

  close(): void {
    this.backup();
    this.db.close();
    log.info('[DatabaseService] Database closed');
  }
}
