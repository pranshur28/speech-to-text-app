import { formatElapsed, shortcutKeys, tailText } from '../format';

describe('shortcutKeys', () => {
  test('splits a shortcut into keys', () => {
    expect(shortcutKeys('Ctrl+Shift+Space', 'Win32')).toEqual(['Ctrl', 'Shift', 'Space']);
  });

  test('shows Command as Win on Windows and ⌘ on macOS', () => {
    expect(shortcutKeys('Command+K', 'Win32')).toEqual(['Win', 'K']);
    expect(shortcutKeys('Command+K', 'MacIntel')).toEqual(['⌘', 'K']);
  });

  test('friendly names for Esc and Return', () => {
    expect(shortcutKeys('Esc', 'Win32')).toEqual(['Esc']);
    expect(shortcutKeys('Return', 'Win32')).toEqual(['Enter']);
  });

  test('empty shortcut has no keys', () => {
    expect(shortcutKeys('', 'Win32')).toEqual([]);
  });
});

describe('formatElapsed', () => {
  test.each([
    [0, '0:00'],
    [9_400, '0:09'],
    [65_000, '1:05'],
    [3_725_000, '1:02:05'],
    [-5, '0:00'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});

describe('tailText', () => {
  test('returns short text unchanged', () => {
    expect(tailText('hello world', 50)).toBe('hello world');
  });

  test('keeps the end of long text, starting at a word boundary', () => {
    const result = tailText('the quick brown fox jumps over the lazy dog', 20);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('lazy dog')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(21);
  });
});
