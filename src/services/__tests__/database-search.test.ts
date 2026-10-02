import { DatabaseService, toFtsQuery } from '../database';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => path.join(__dirname, 'test-db-search-data')),
  },
}));

const testDataDir = path.join(__dirname, 'test-db-search-data');
const testDbPath = path.join(testDataDir, 'data', 'transcriptions.db');

function ftsIntegrityOk(db: DatabaseService): boolean {
  try {
    db.getDb().exec(`INSERT INTO transcriptions_fts(transcriptions_fts, rank) VALUES ('integrity-check', 1)`);
    return true;
  } catch {
    return false;
  }
}

describe('toFtsQuery', () => {
  test('quotes each word so FTS operators are treated literally', () => {
    expect(toFtsQuery('budget review')).toBe('"budget" "review"');
  });

  test('escapes embedded double quotes', () => {
    expect(toFtsQuery('say "hi"')).toBe('"say" """hi"""');
  });

  test('returns empty string for blank input', () => {
    expect(toFtsQuery('   ')).toBe('');
    expect(toFtsQuery('')).toBe('');
  });
});

describe('DatabaseService search and index', () => {
  let db: DatabaseService;

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
    db = new DatabaseService();
  });

  afterEach(() => {
    db?.close();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });

  const save = (text: string, extra: { is_favorite?: number; timestamp?: number } = {}) =>
    db.saveTranscription({
      raw_text: text,
      formatted_text: text,
      timestamp: extra.timestamp ?? Date.now(),
      is_favorite: extra.is_favorite ?? 0,
    });

  test('is at schema version 3', () => {
    const row = db.getDb().prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(row.version).toBe(3);
  });

  test.each(['"', 'don\'t', 'well-known', '(test', 'foo*', 'a:b', 'AND', 'NOT', '-'])(
    'search text %p does not throw',
    (query) => {
      save("don't use the well-known (test) approach");
      expect(() => db.searchTranscriptions(query)).not.toThrow();
      expect(() => db.countSearchResults(query)).not.toThrow();
    }
  );

  test('finds text containing punctuation', () => {
    save('the well-known approach');
    expect(db.searchTranscriptions('well-known')).toHaveLength(1);
  });

  test('updated text is searchable and old text is not', () => {
    const id = save('original wording');
    db.updateTranscription(id, { formatted_text: 'replacement phrasing' });

    // raw_text still contains "original", formatted_text no longer does
    expect(db.searchTranscriptions('phrasing')).toHaveLength(1);
    expect(db.searchTranscriptions('wording')).toHaveLength(1);
    expect(ftsIntegrityOk(db)).toBe(true);
  });

  test('deleted transcriptions leave no stale index entries', () => {
    const id = save('ephemeral note');
    db.deleteTranscription(id);

    expect(db.searchTranscriptions('ephemeral')).toHaveLength(0);
    expect(ftsIntegrityOk(db)).toBe(true);
  });

  test('counts respect search text and filters', () => {
    save('budget meeting', { is_favorite: 1 });
    save('budget review');
    save('team lunch', { is_favorite: 1 });

    expect(db.countTranscriptions()).toBe(3);
    expect(db.countTranscriptions({ isFavorite: true })).toBe(2);
    expect(db.countSearchResults('budget')).toBe(2);
    expect(db.countSearchResults('budget', { isFavorite: true })).toBe(1);
  });

  test('offset without limit is valid SQL', () => {
    save('one', { timestamp: 1 });
    save('two', { timestamp: 2 });
    save('three', { timestamp: 3 });

    const rows = db.getTranscriptions({ offset: 1 });
    expect(rows.map((r) => r.formatted_text)).toEqual(['two', 'one']);
  });
});

describe('DatabaseService migration from version 2', () => {
  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });

  test('replaces the old FTS triggers and rebuilds the index', () => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    // Create a current database, then downgrade it to look like a version 2 install
    new DatabaseService().close();
    const raw = new Database(testDbPath);
    raw.exec(`
      DROP TRIGGER transcriptions_ad;
      DROP TRIGGER transcriptions_au;
      CREATE TRIGGER transcriptions_ad AFTER DELETE ON transcriptions BEGIN
        DELETE FROM transcriptions_fts WHERE rowid = old.id;
      END;
      CREATE TRIGGER transcriptions_au AFTER UPDATE ON transcriptions BEGIN
        UPDATE transcriptions_fts SET raw_text = new.raw_text, formatted_text = new.formatted_text
        WHERE rowid = old.id;
      END;
      UPDATE schema_version SET version = 2;
    `);
    raw.prepare(`INSERT INTO transcriptions (raw_text, formatted_text, timestamp, created_at) VALUES (?, ?, ?, ?)`)
      .run('legacy entry', 'legacy entry', 1, 1);
    raw.close();

    const db = new DatabaseService();
    try {
      const version = db.getDb().prepare('SELECT version FROM schema_version').get() as { version: number };
      expect(version.version).toBe(3);
      expect(db.searchTranscriptions('legacy')).toHaveLength(1);

      const [row] = db.getTranscriptions();
      db.deleteTranscription(row.id);
      expect(db.searchTranscriptions('legacy')).toHaveLength(0);
      expect(ftsIntegrityOk(db)).toBe(true);
    } finally {
      db.close();
    }
  });
});
