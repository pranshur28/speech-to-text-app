import { DatabaseService } from '../database';
import { DictionaryService, KEYTERM_TOKEN_BUDGET, estimateKeytermTokens } from '../dictionary';
import * as fs from 'fs';
import * as path from 'path';

// Mock electron app.getPath
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => path.join(__dirname, 'test-dictionary-data')),
  },
}));

describe('DictionaryService', () => {
  const testDataDir = path.join(__dirname, 'test-dictionary-data');
  let db: DatabaseService;
  let dict: DictionaryService;

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
    db = new DatabaseService();
    dict = new DictionaryService(db.getDb());
  });

  afterEach(() => {
    db?.close();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });

  describe('applyReplacements', () => {
    test('replaces whole words only', () => {
      dict.addEntry({ spoken_phrase: 'cat', replacement: 'dog' });
      expect(dict.applyReplacements('the cat sat in the category')).toBe('the dog sat in the category');
    });

    test('matches next to punctuation', () => {
      dict.addEntry({ spoken_phrase: 'cat', replacement: 'dog' });
      expect(dict.applyReplacements('Cat, cat. (cat)')).toBe('dog, dog. (dog)');
    });

    test('is case-insensitive by default', () => {
      dict.addEntry({ spoken_phrase: 'kleene star', replacement: 'K*' });
      expect(dict.applyReplacements('The Kleene Star operator')).toBe('The K* operator');
    });

    test('respects case-sensitive entries', () => {
      dict.addEntry({ spoken_phrase: 'Go', replacement: 'Golang', is_case_sensitive: true });
      expect(dict.applyReplacements('Go is fun, go outside')).toBe('Golang is fun, go outside');
    });

    test('inserts "$" in replacements literally', () => {
      dict.addEntry({ spoken_phrase: 'price', replacement: '$5 & $&' });
      expect(dict.applyReplacements('the price is right')).toBe('the $5 & $& is right');
    });

    test('prefers the longest phrase first', () => {
      dict.addEntry({ spoken_phrase: 'kleene star', replacement: 'K*' });
      dict.addEntry({ spoken_phrase: 'kleene star closure', replacement: 'K* closure (Σ*)' });
      expect(dict.applyReplacements('take the kleene star closure')).toBe('take the K* closure (Σ*)');
    });

    test('handles phrases with regex characters', () => {
      dict.addEntry({ spoken_phrase: 'c++', replacement: 'C++' });
      expect(dict.applyReplacements('I write c++ daily')).toBe('I write C++ daily');
    });

    test('ignores disabled entries', () => {
      const id = dict.addEntry({ spoken_phrase: 'cat', replacement: 'dog' });
      dict.toggleEnabled(id);
      expect(dict.applyReplacements('cat')).toBe('cat');
    });
  });

  describe('getKeyterms', () => {
    test('uses the replacement when it is a speakable word', () => {
      dict.addEntry({ spoken_phrase: 'deep gram', replacement: 'Deepgram' });
      expect(dict.getKeyterms().terms).toEqual(['Deepgram']);
    });

    test('uses the spoken phrase when the replacement is symbols', () => {
      dict.addEntry({ spoken_phrase: 'Kleene star', replacement: 'K*' });
      expect(dict.getKeyterms().terms).toEqual(['Kleene star']);
    });

    test('deduplicates case-insensitively and skips disabled entries', () => {
      dict.addEntry({ spoken_phrase: 'kubernetes', replacement: 'Kubernetes' });
      dict.addEntry({ spoken_phrase: 'cube ernetes', replacement: 'kubernetes' });
      const disabled = dict.addEntry({ spoken_phrase: 'postgres', replacement: 'PostgreSQL' });
      dict.toggleEnabled(disabled);

      expect(dict.getKeyterms().terms).toEqual(['Kubernetes']);
    });

    test('stays within the token budget and reports dropped entries', () => {
      for (let i = 0; i < 200; i++) {
        dict.addEntry({ spoken_phrase: `phrase number ${i}`, replacement: `Terminology${i}` });
      }
      const { terms, estimatedTokens, dropped } = dict.getKeyterms();

      expect(estimatedTokens).toBeLessThanOrEqual(KEYTERM_TOKEN_BUDGET);
      expect(terms.reduce((sum, t) => sum + estimateKeytermTokens(t), 0)).toBe(estimatedTokens);
      expect(dropped).toBeGreaterThan(0);
      expect(terms.length + dropped).toBe(200);
      // Oldest entries are kept
      expect(terms[0]).toBe('Terminology0');
    });
  });
});
