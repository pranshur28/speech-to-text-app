jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.') } }));

import { UiohookKey } from 'uiohook-napi';
import { ShortcutManager, isSynthesizedKey } from '../shortcut-manager';

describe('isSynthesizedKey', () => {
  test('keys our typing and pasting can generate are filtered', () => {
    for (const key of ['A', 'Z', '5', 'Space', 'Backspace', 'Comma', 'Shift', 'Ctrl'] as const) {
      expect(isSynthesizedKey((UiohookKey as any)[key])).toBe(true);
    }
  });

  test('typical hold-to-talk keys are never filtered, so a release is never missed', () => {
    for (const key of ['F9', 'F13', 'CapsLock', 'Insert', 'Alt', 'Meta', 'ArrowUp'] as const) {
      expect(isSynthesizedKey((UiohookKey as any)[key])).toBe(false);
    }
  });
});

describe('parseShortcutToKeyCodes', () => {
  const mgr = new ShortcutManager(() => null);

  test('parses modifiers and a key', () => {
    expect(mgr.parseShortcutToKeyCodes('Ctrl+Shift+Space')).toMatchObject({
      requiresCtrl: true,
      requiresShift: true,
      key: UiohookKey.Space,
    });
  });

  test('digit keys resolve (previously looked up a non-existent "Digit5" name)', () => {
    expect(mgr.parseShortcutToKeyCodes('Ctrl+5').key).toBe((UiohookKey as any)['5']);
  });
});
