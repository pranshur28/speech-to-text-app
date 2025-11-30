import { DatabaseService, TranscriptionInsert } from '../database';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => path.join(__dirname, 'test-data')),
  },
}));

describe('DatabaseService', () => {
  let db: DatabaseService;
  const testDataDir = path.join(__dirname, 'test-data');
  const testDbPath = path.join(testDataDir, 'data', 'transcriptions.db');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    // Create new database instance
    db = new DatabaseService();
  });

  afterEach(() => {
    // Close database and clean up
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    test('should create all required tables', () => {
      const stats = db.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('favorites');
      expect(stats).toHaveProperty('totalTags');
    });

    test('should initialize with zero transcriptions', () => {
      const stats = db.getStats();
      expect(stats.total).toBe(0);
      expect(stats.favorites).toBe(0);
    });
  });

  describe('CRUD Operations', () => {
    test('should save a transcription', () => {
      const transcription: TranscriptionInsert = {
        raw_text: 'Hello world',
        formatted_text: 'Hello world!',
        timestamp: Date.now(),
        formatting_profile: 'casual',
        is_favorite: 0,
      };

      const id = db.saveTranscription(transcription);
      expect(id).toBeGreaterThan(0);

      const stats = db.getStats();
      expect(stats.total).toBe(1);
    });

    test('should retrieve a transcription by ID', () => {
      const transcription: TranscriptionInsert = {
        raw_text: 'Test transcription',
        formatted_text: 'Test transcription.',
        timestamp: Date.now(),
        formatting_profile: 'casual',
        is_favorite: 0,
      };

      const id = db.saveTranscription(transcription);
      const retrieved = db.getTranscription(id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.raw_text).toBe('Test transcription');
      expect(retrieved?.formatted_text).toBe('Test transcription.');
    });

    test('should return null for non-existent transcription', () => {
      const retrieved = db.getTranscription(999);
      expect(retrieved).toBeNull();
    });

    test('should update a transcription', () => {
      const transcription: TranscriptionInsert = {
        raw_text: 'Original text',
        formatted_text: 'Original formatted text',
        timestamp: Date.now(),
      };

      const id = db.saveTranscription(transcription);

      db.updateTranscription(id, {
        formatted_text: 'Updated formatted text',
      });

      const updated = db.getTranscription(id);
      expect(updated?.formatted_text).toBe('Updated formatted text');
      expect(updated?.raw_text).toBe('Original text'); // Unchanged
    });

    test('should delete a transcription', () => {
      const transcription: TranscriptionInsert = {
        raw_text: 'To be deleted',
        formatted_text: 'To be deleted',
        timestamp: Date.now(),
      };

      const id = db.saveTranscription(transcription);
      expect(db.getStats().total).toBe(1);

      db.deleteTranscription(id);
      expect(db.getStats().total).toBe(0);
      expect(db.getTranscription(id)).toBeNull();
    });

    test('should toggle favorite status', () => {
      const transcription: TranscriptionInsert = {
        raw_text: 'Favorite test',
        formatted_text: 'Favorite test',
        timestamp: Date.now(),
        is_favorite: 0,
      };

      const id = db.saveTranscription(transcription);
      expect(db.getTranscription(id)?.is_favorite).toBe(0);

      db.toggleFavorite(id);
      expect(db.getTranscription(id)?.is_favorite).toBe(1);

      db.toggleFavorite(id);
      expect(db.getTranscription(id)?.is_favorite).toBe(0);
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      // Add test data
      const now = Date.now();

      db.saveTranscription({
        raw_text: 'First note',
        formatted_text: 'First note',
        timestamp: now - 3000,
        is_favorite: 1,
      });

      db.saveTranscription({
        raw_text: 'Second note',
        formatted_text: 'Second note',
        timestamp: now - 2000,
        is_favorite: 0,
      });

      db.saveTranscription({
        raw_text: 'Third note',
        formatted_text: 'Third note',
        timestamp: now - 1000,
        is_favorite: 1,
      });
    });

    test('should get all transcriptions', () => {
      const all = db.getTranscriptions();
      expect(all).toHaveLength(3);
    });

    test('should return transcriptions in descending timestamp order', () => {
      const all = db.getTranscriptions();
      expect(all[0].formatted_text).toBe('Third note');
      expect(all[1].formatted_text).toBe('Second note');
      expect(all[2].formatted_text).toBe('First note');
    });

    test('should filter by favorite status', () => {
      const favorites = db.getTranscriptions({ isFavorite: true });
      expect(favorites).toHaveLength(2);
      expect(favorites.every(t => t.is_favorite === 1)).toBe(true);
    });

    test('should limit results', () => {
      const limited = db.getTranscriptions({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    test('should support pagination with offset', () => {
      const page1 = db.getTranscriptions({ limit: 2, offset: 0 });
      const page2 = db.getTranscriptions({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    test('should filter by date range', () => {
      const now = Date.now();
      const startDate = now - 2500;
      const endDate = now;

      const filtered = db.getTranscriptions({ startDate, endDate });
      expect(filtered).toHaveLength(2); // Second and Third notes
    });
  });

  describe('Full-Text Search', () => {
    beforeEach(() => {
      db.saveTranscription({
        raw_text: 'Meeting with Sarah about Q1 budget',
        formatted_text: 'Meeting with Sarah about Q1 budget',
        timestamp: Date.now(),
      });

      db.saveTranscription({
        raw_text: 'Budget review for Q2',
        formatted_text: 'Budget review for Q2',
        timestamp: Date.now(),
      });

      db.saveTranscription({
        raw_text: 'Call with John about project timeline',
        formatted_text: 'Call with John about project timeline',
        timestamp: Date.now(),
      });
    });

    test('should search by single keyword', () => {
      const results = db.searchTranscriptions('budget');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.formatted_text.toLowerCase().includes('budget'))).toBe(true);
    });

    test('should search by multiple keywords', () => {
      const results = db.searchTranscriptions('sarah budget');
      expect(results).toHaveLength(1);
      expect(results[0].formatted_text).toContain('Sarah');
      expect(results[0].formatted_text).toContain('budget');
    });

    test('should return empty array for no matches', () => {
      const results = db.searchTranscriptions('nonexistent');
      expect(results).toHaveLength(0);
    });

    test('should search in both raw and formatted text', () => {
      const results = db.searchTranscriptions('Q1');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should return all transcriptions when query is empty', () => {
      const results = db.searchTranscriptions('');
      expect(results).toHaveLength(3);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      db.saveTranscription({
        raw_text: 'Note 1',
        formatted_text: 'First formatted note',
        timestamp: 1000000,
      });

      db.saveTranscription({
        raw_text: 'Note 2',
        formatted_text: 'Second formatted note',
        timestamp: 2000000,
      });
    });

    test('should export to JSON', () => {
      const transcriptions = db.getTranscriptions();
      const ids = transcriptions.map(t => t.id);
      const json = db.exportTranscriptions(ids, 'json');

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].formatted_text).toBe('First formatted note');
    });

    test('should export to Markdown', () => {
      const transcriptions = db.getTranscriptions();
      const ids = transcriptions.map(t => t.id);
      const markdown = db.exportTranscriptions(ids, 'markdown');

      expect(markdown).toContain('First formatted note');
      expect(markdown).toContain('Second formatted note');
      expect(markdown).toContain('---'); // Markdown separator
    });

    test('should export to plain text', () => {
      const transcriptions = db.getTranscriptions();
      const ids = transcriptions.map(t => t.id);
      const txt = db.exportTranscriptions(ids, 'txt');

      expect(txt).toContain('First formatted note');
      expect(txt).toContain('Second formatted note');
      expect(txt).toContain('='.repeat(50)); // Text separator
    });
  });

  describe('Backup and Recovery', () => {
    test('should create backup file', () => {
      db.saveTranscription({
        raw_text: 'Test backup',
        formatted_text: 'Test backup',
        timestamp: Date.now(),
      });

      db.backup();
      const backupPath = `${testDbPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    test('should create backup on close', () => {
      db.saveTranscription({
        raw_text: 'Test',
        formatted_text: 'Test',
        timestamp: Date.now(),
      });

      db.close();
      const backupPath = `${testDbPath}.bak`;
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats', () => {
      db.saveTranscription({
        raw_text: 'Note 1',
        formatted_text: 'Note 1',
        timestamp: Date.now(),
        is_favorite: 1,
      });

      db.saveTranscription({
        raw_text: 'Note 2',
        formatted_text: 'Note 2',
        timestamp: Date.now(),
        is_favorite: 0,
      });

      db.saveTranscription({
        raw_text: 'Note 3',
        formatted_text: 'Note 3',
        timestamp: Date.now(),
        is_favorite: 1,
      });

      const stats = db.getStats();
      expect(stats.total).toBe(3);
      expect(stats.favorites).toBe(2);
    });
  });
});
