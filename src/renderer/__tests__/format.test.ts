import { formatElapsed, shortcutKeys } from '../format';

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
