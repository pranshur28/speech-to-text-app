import { DatabaseService } from '../services/database';
import { SearchService } from '../services/search';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => path.join(__dirname, 'test-integration-data')),
  },
}));

describe('Integration Tests', () => {
  const testDataDir = path.join(__dirname, 'test-integration-data');
  let db: DatabaseService;
  let searchService: SearchService;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Service Initialization', () => {
    test('should initialize database service successfully', () => {
      expect(() => {
        db = new DatabaseService();
      }).not.toThrow();

      expect(db).toBeDefined();
    });

    test('should initialize search service with database', () => {
      db = new DatabaseService();

      expect(() => {
        searchService = new SearchService(db);
      }).not.toThrow();

      expect(searchService).toBeDefined();
    });

    test('should create database file on initialization', () => {
      db = new DatabaseService();

      const dbPath = path.join(testDataDir, 'data', 'transcriptions.db');
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  describe('Complete Workflow', () => {
    beforeEach(() => {
      db = new DatabaseService();
      searchService = new SearchService(db);
    });

    test('should handle complete transcription workflow', () => {
      // 1. Save a new transcription
      const transcriptionData = {
        raw_text: 'Meeting with team about project deadline',
        formatted_text: 'Meeting with team about project deadline.',
        timestamp: Date.now(),
        formatting_profile: 'casual',
        is_favorite: 0,
      };

      const id = db.saveTranscription(transcriptionData);
      expect(id).toBeGreaterThan(0);

      // 2. Retrieve the transcription
      const retrieved = db.getTranscription(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.formatted_text).toBe(transcriptionData.formatted_text);

      // 3. Search for the transcription
      const searchResult = searchService.search({ query: 'meeting' });
      expect(searchResult.transcriptions).toHaveLength(1);
      expect(searchResult.transcriptions[0].id).toBe(id);

      // 4. Update the transcription
      db.updateTranscription(id, { formatted_text: 'Updated meeting notes.' });
      const updated = db.getTranscription(id);
      expect(updated?.formatted_text).toBe('Updated meeting notes.');

      // 5. Mark as favorite
      db.toggleFavorite(id);
      const favorite = db.getTranscription(id);
      expect(favorite?.is_favorite).toBe(1);

      // 6. Get favorites
      const favorites = searchService.getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe(id);

      // 7. Export
      const exported = db.exportTranscriptions([id], 'json');
      expect(() => JSON.parse(exported)).not.toThrow();

      // 8. Delete
      db.deleteTranscription(id);
      expect(db.getTranscription(id)).toBeNull();
    });

    test('should handle multiple transcriptions with search', () => {
      const now = Date.now();

      // Add multiple transcriptions
      const ids = [
        db.saveTranscription({
          raw_text: 'Budget planning for Q1',
          formatted_text: 'Budget planning for Q1',
          timestamp: now - 3000,
          is_favorite: 1,
        }),
        db.saveTranscription({
          raw_text: 'Team meeting notes',
          formatted_text: 'Team meeting notes',
          timestamp: now - 2000,
          is_favorite: 0,
        }),
        db.saveTranscription({
          raw_text: 'Budget review Q2',
          formatted_text: 'Budget review Q2',
          timestamp: now - 1000,
          is_favorite: 0,
        }),
      ];

      expect(ids).toHaveLength(3);

      // Search for 'budget'
      const budgetResults = searchService.search({ query: 'budget' });
      expect(budgetResults.transcriptions).toHaveLength(2);

      // Search for favorites
      const favoriteResults = searchService.search({ query: 'fav:true' });
      expect(favoriteResults.transcriptions).toHaveLength(1);

      // Get recent
      const recent = searchService.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].formatted_text).toContain('Q2'); // Most recent
    });

    test('should persist data across database reopens', () => {
      // Save data
      const id = db.saveTranscription({
        raw_text: 'Persistent test',
        formatted_text: 'This should persist',
        timestamp: Date.now(),
      });

      // Close database
      db.close();

      // Reopen database
      db = new DatabaseService();
      searchService = new SearchService(db);

      // Verify data persists
      const retrieved = db.getTranscription(id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.formatted_text).toBe('This should persist');

      const stats = db.getStats();
      expect(stats.total).toBe(1);
    });

    test('should handle FTS5 search with special characters', () => {
      db.saveTranscription({
        raw_text: 'Email: user@example.com',
        formatted_text: 'Email: user@example.com',
        timestamp: Date.now(),
      });

      db.saveTranscription({
        raw_text: 'Price: $100.50',
        formatted_text: 'Price: $100.50',
        timestamp: Date.now(),
      });

      // Search should work even with special characters
      const emailResults = searchService.search({ query: 'email' });
      expect(emailResults.transcriptions).toHaveLength(1);

      const priceResults = searchService.search({ query: 'price' });
      expect(priceResults.transcriptions).toHaveLength(1);
    });

    test('should handle large dataset efficiently', () => {
      const startTime = Date.now();

      // Insert 100 transcriptions
      for (let i = 0; i < 100; i++) {
        db.saveTranscription({
          raw_text: `Transcription number ${i} about various topics`,
          formatted_text: `Transcription number ${i} about various topics`,
          timestamp: Date.now() + i,
          is_favorite: i % 10 === 0 ? 1 : 0,
        });
      }

      const insertTime = Date.now() - startTime;

      // Search should be fast
      const searchStartTime = Date.now();
      const results = searchService.search({ query: 'transcription' });
      const searchTime = Date.now() - searchStartTime;

      expect(results.transcriptions.length).toBeLessThanOrEqual(50); // Default limit
      expect(insertTime).toBeLessThan(5000); // Should insert 100 records in < 5 seconds
      expect(searchTime).toBeLessThan(100); // Search should be < 100ms
    });

    test('should handle concurrent operations safely', () => {
      // Save multiple transcriptions rapidly
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(db.saveTranscription({
          raw_text: `Note ${i}`,
          formatted_text: `Note ${i}`,
          timestamp: Date.now() + i,
        }))
      );

      return Promise.all(promises).then((ids) => {
        expect(ids).toHaveLength(10);
        expect(new Set(ids).size).toBe(10); // All IDs should be unique

        const stats = db.getStats();
        expect(stats.total).toBe(10);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      db = new DatabaseService();
      searchService = new SearchService(db);
    });

    test('should handle invalid transcription ID gracefully', () => {
      const result = db.getTranscription(99999);
      expect(result).toBeNull();
    });

    test('should handle empty search query', () => {
      const result = searchService.search({ query: '' });
      expect(result).toBeDefined();
      expect(result.transcriptions).toBeDefined();
      expect(Array.isArray(result.transcriptions)).toBe(true);
    });

    test('should handle search with no results', () => {
      const result = searchService.search({ query: 'nonexistent_term_xyz' });
      expect(result.transcriptions).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    test('should handle update of non-existent transcription', () => {
      expect(() => {
        db.updateTranscription(99999, { formatted_text: 'Updated' });
      }).not.toThrow();
    });

    test('should handle delete of non-existent transcription', () => {
      expect(() => {
        db.deleteTranscription(99999);
      }).not.toThrow();
    });
  });

  describe('Backup and Recovery Integration', () => {
    beforeEach(() => {
      db = new DatabaseService();
    });

    test('should create backup when closing database', () => {
      db.saveTranscription({
        raw_text: 'Backup test',
        formatted_text: 'Backup test',
        timestamp: Date.now(),
      });

      db.close();

      const dbPath = path.join(testDataDir, 'data', 'transcriptions.db');
      const backupPath = `${dbPath}.bak`;

      expect(fs.existsSync(backupPath)).toBe(true);
    });

    test('should backup preserve data integrity', () => {
      const id = db.saveTranscription({
        raw_text: 'Backup integrity test',
        formatted_text: 'Backup integrity test',
        timestamp: Date.now(),
      });

      db.backup();

      const dbPath = path.join(testDataDir, 'data', 'transcriptions.db');
      const backupPath = `${dbPath}.bak`;

      // Backup file should exist and have size
      const backupStats = fs.statSync(backupPath);
      expect(backupStats.size).toBeGreaterThan(0);

      // Original should still work
      const retrieved = db.getTranscription(id);
      expect(retrieved).not.toBeNull();
    });
  });
});
