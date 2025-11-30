import { SearchService } from '../search';
import { DatabaseService, TranscriptionInsert } from '../database';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => path.join(__dirname, 'test-search-data')),
  },
}));

describe('SearchService', () => {
  let db: DatabaseService;
  let searchService: SearchService;
  const testDataDir = path.join(__dirname, 'test-search-data');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    // Create new database and search service
    db = new DatabaseService();
    searchService = new SearchService(db);

    // Add test data
    const now = Date.now();

    db.saveTranscription({
      raw_text: 'Meeting with Sarah about Q1 budget planning',
      formatted_text: 'Meeting with Sarah about Q1 budget planning',
      timestamp: now - 5000,
      is_favorite: 1,
    });

    db.saveTranscription({
      raw_text: 'Budget review for Q2 goals',
      formatted_text: 'Budget review for Q2 goals',
      timestamp: now - 4000,
      is_favorite: 0,
    });

    db.saveTranscription({
      raw_text: 'Call with John about project timeline',
      formatted_text: 'Call with John about project timeline',
      timestamp: now - 3000,
      is_favorite: 1,
    });

    db.saveTranscription({
      raw_text: 'Team meeting notes from today',
      formatted_text: 'Team meeting notes from today',
      timestamp: now - 2000,
      is_favorite: 0,
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Query Parsing', () => {
    test('should parse plain text query', () => {
      const parsed = searchService.parseQuery('meeting notes');
      expect(parsed.searchText).toBe('meeting notes');
      expect(parsed.filters).toEqual({});
    });

    test('should parse tag filter with tag: prefix', () => {
      const parsed = searchService.parseQuery('budget tag:work');
      expect(parsed.searchText).toBe('budget');
      expect(parsed.filters.tags).toEqual(['work']);
    });

    test('should parse tag filter with # prefix', () => {
      const parsed = searchService.parseQuery('meeting #urgent');
      expect(parsed.searchText).toBe('meeting');
      expect(parsed.filters.tags).toEqual(['urgent']);
    });

    test('should parse multiple tags', () => {
      const parsed = searchService.parseQuery('notes tag:work #meeting');
      expect(parsed.searchText).toBe('notes');
      expect(parsed.filters.tags).toEqual(['work', 'meeting']);
    });

    test('should parse favorite filter', () => {
      const parsed = searchService.parseQuery('budget fav:true');
      expect(parsed.searchText).toBe('budget');
      expect(parsed.filters.isFavorite).toBe(true);
    });

    test('should parse favorite filter as false', () => {
      const parsed = searchService.parseQuery('notes fav:false');
      expect(parsed.searchText).toBe('notes');
      expect(parsed.filters.isFavorite).toBe(false);
    });

    test('should parse date:today filter', () => {
      const parsed = searchService.parseQuery('meeting date:today');
      expect(parsed.searchText).toBe('meeting');
      expect(parsed.filters.startDate).toBeDefined();

      // Check that startDate is from today
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      expect(parsed.filters.startDate).toBe(startOfToday);
    });

    test('should parse date:week filter', () => {
      const parsed = searchService.parseQuery('notes date:week');
      expect(parsed.searchText).toBe('notes');
      expect(parsed.filters.startDate).toBeDefined();
    });

    test('should parse date:month filter', () => {
      const parsed = searchService.parseQuery('review date:month');
      expect(parsed.searchText).toBe('review');
      expect(parsed.filters.startDate).toBeDefined();
    });

    test('should parse combined filters', () => {
      const parsed = searchService.parseQuery('budget tag:work fav:true date:week');
      expect(parsed.searchText).toBe('budget');
      expect(parsed.filters.tags).toEqual(['work']);
      expect(parsed.filters.isFavorite).toBe(true);
      expect(parsed.filters.startDate).toBeDefined();
    });

    test('should handle empty query', () => {
      const parsed = searchService.parseQuery('');
      expect(parsed.searchText).toBe('');
      expect(parsed.filters).toEqual({});
    });

    test('should handle query with only filters', () => {
      const parsed = searchService.parseQuery('fav:true #urgent');
      expect(parsed.searchText).toBe('');
      expect(parsed.filters.isFavorite).toBe(true);
      expect(parsed.filters.tags).toEqual(['urgent']);
    });
  });

  describe('Search Functionality', () => {
    test('should search with plain text query', () => {
      const result = searchService.search({ query: 'budget' });
      expect(result.transcriptions).toHaveLength(2);
      expect(result.transcriptions.every(t =>
        t.formatted_text.toLowerCase().includes('budget')
      )).toBe(true);
    });

    test('should return all transcriptions for empty query', () => {
      const result = searchService.search({ query: '' });
      expect(result.transcriptions).toHaveLength(4);
    });

    test('should search with embedded favorite filter', () => {
      const result = searchService.search({ query: 'meeting fav:true' });
      expect(result.transcriptions).toHaveLength(1);
      expect(result.transcriptions[0].formatted_text).toContain('Sarah');
    });

    test('should search with user-provided filters', () => {
      const result = searchService.search({
        query: 'meeting',
        filters: { isFavorite: true }
      });
      expect(result.transcriptions.length).toBeGreaterThan(0);
      expect(result.transcriptions.every(t => t.is_favorite === 1)).toBe(true);
    });

    test('should merge embedded and user filters', () => {
      const result = searchService.search({
        query: 'fav:true',
        filters: { isFavorite: false } // User filter overrides embedded
      });

      // User filter overrides embedded filter in current implementation
      expect(result.transcriptions.every(t => t.is_favorite === 0)).toBe(true);
    });

    test('should respect limit parameter', () => {
      const result = searchService.search({ query: '', limit: 2 });
      expect(result.transcriptions).toHaveLength(2);
    });

    test('should respect offset parameter for pagination', () => {
      const page1 = searchService.search({ query: '', limit: 2, offset: 0 });
      const page2 = searchService.search({ query: '', limit: 2, offset: 2 });

      expect(page1.transcriptions).toHaveLength(2);
      expect(page2.transcriptions).toHaveLength(2);
      expect(page1.transcriptions[0].id).not.toBe(page2.transcriptions[0].id);
    });

    test('should include pagination metadata', () => {
      const result = searchService.search({ query: '', limit: 2, offset: 0 });
      expect(result.total).toBe(4);
      expect(result.hasMore).toBe(true);
    });

    test('should indicate no more results when at end', () => {
      const result = searchService.search({ query: '', limit: 10, offset: 0 });
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    test('should get recent transcriptions', () => {
      const recent = searchService.getRecent(3);
      expect(recent).toHaveLength(3);

      // Should be in descending timestamp order (newest first)
      expect(recent[0].formatted_text).toContain('Team meeting');
      expect(recent[2].formatted_text).toContain('Budget review');
    });

    test('should get recent with custom limit', () => {
      const recent = searchService.getRecent(2);
      expect(recent).toHaveLength(2);
    });

    test('should get favorites only', () => {
      const favorites = searchService.getFavorites();
      expect(favorites).toHaveLength(2);
      expect(favorites.every(t => t.is_favorite === 1)).toBe(true);
    });

    test('should get transcriptions by date range', () => {
      const now = Date.now();
      const startDate = new Date(now - 4500);
      const endDate = new Date(now);

      const inRange = searchService.getByDateRange(startDate, endDate);
      expect(inRange.length).toBeGreaterThan(0);
      expect(inRange.every(t =>
        t.timestamp >= startDate.getTime() && t.timestamp <= endDate.getTime()
      )).toBe(true);
    });

    test('should respect limit in getByDateRange', () => {
      const now = Date.now();
      const startDate = new Date(now - 10000);
      const endDate = new Date(now);

      const limited = searchService.getByDateRange(startDate, endDate, 2);
      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Complex Queries', () => {
    test('should handle complex search with multiple filters', () => {
      const result = searchService.search({
        query: 'meeting fav:true',
        limit: 10
      });

      expect(result.transcriptions.length).toBeGreaterThan(0);
      expect(result.transcriptions.every(t =>
        t.formatted_text.toLowerCase().includes('meeting') &&
        t.is_favorite === 1
      )).toBe(true);
    });

    test('should return empty results for impossible combination', () => {
      const result = searchService.search({
        query: 'nonexistent term that does not exist'
      });

      expect(result.transcriptions).toHaveLength(0);
      expect(result.total).toBeGreaterThan(0); // Total still shows all transcriptions
    });
  });
});
