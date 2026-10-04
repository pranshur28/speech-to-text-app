import { uIOhook, UiohookKey } from 'uiohook-napi';
import { BrowserWindow } from 'electron';
import log from '../utils/logger';
import { HoldKeyGuard, LiftedModifiers } from './hold-key-guard';

// Keys our own simulated input can produce: typing (letters, digits, punctuation, Space,
// Shift), corrections (Backspace), the "press enter" voice command and clipboard paste (Ctrl+V).
const SYNTHESIZED_KEY_NAMES = [
  'Backspace', 'Space', 'Enter', 'Shift', 'ShiftRight', 'Ctrl', 'CtrlRight',
  'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Slash', 'Backquote',
  'BracketLeft', 'Backslash', 'BracketRight', 'Quote',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
];
const SYNTHESIZED_KEYS = new Set<number>(
  SYNTHESIZED_KEY_NAMES.map((name) => (UiohookKey as any)[name]).filter((code) => code !== undefined)
);

/** True for keys that our own typing/pasting can generate (and so must be ignored meanwhile). */
export function isSynthesizedKey(keycode: number): boolean {
  return SYNTHESIZED_KEYS.has(keycode);
}

interface ParsedShortcut {
  requiresMeta: boolean;
  requiresCtrl: boolean;
  requiresAlt: boolean;
  requiresShift: boolean;
  key: number | null;
}

export class ShortcutManager {
  private toggleShortcut = '';
  private holdShortcut = '';
  private isTogglePressed = false;
  private isHoldPressed = false;
  private pressedKeys = new Set<number>();
  private getMainWindow: () => BrowserWindow | null;

  // Paste mode: while our own typing/pasting runs, ignore events for keys it can generate.
  // Other keys (F-keys, CapsLock, …) are still tracked, so a hold-to-talk release isn't missed.
  private inPasteMode = false;

  // Windows: lets hold-to-talk type while the hotkey is still held, and reports its real release
  private holdGuard = new HoldKeyGuard(() => this.releaseHold());

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  /**
   * During hold-to-talk, release the held modifiers so our input isn't read as shortcuts.
   * Null when nothing was lifted (not holding, or not supported), so held modifiers still apply.
   */
  liftHeldModifiers(): LiftedModifiers | null {
    return this.isHoldPressed ? this.holdGuard.liftModifiers() : null;
  }

  private releaseHold() {
    if (!this.isHoldPressed) return;
    this.isHoldPressed = false;
    this.holdGuard.deactivate();
    log.info('Hold shortcut released - stopping recording');
    const win = this.getMainWindow();
    if (win) win.webContents.send('stop-recording');
  }

  /**
   * Enter paste mode so synthetic keystrokes from nut-js don't corrupt the hotkey state.
   * Returns which modifier keys are currently physically held.
   */
  enterPasteMode(): { ctrlHeld: boolean; shiftHeld: boolean; altHeld: boolean; metaHeld: boolean } {
    this.inPasteMode = true;
    return {
      ctrlHeld: this.pressedKeys.has(UiohookKey.Ctrl) || this.pressedKeys.has(UiohookKey.CtrlRight),
      shiftHeld: this.pressedKeys.has(UiohookKey.Shift) || this.pressedKeys.has(UiohookKey.ShiftRight),
      altHeld: this.pressedKeys.has(UiohookKey.Alt) || this.pressedKeys.has(UiohookKey.AltRight),
      metaHeld: this.pressedKeys.has(UiohookKey.Meta) || this.pressedKeys.has(UiohookKey.MetaRight),
    };
  }

  exitPasteMode(): void {
    this.inPasteMode = false;
  }

  // Every key event carries the OS modifier state. Use it to drop modifiers whose release
  // we missed (e.g. released during paste mode), so they don't look held forever.
  private reconcileModifiers(e: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean }) {
    const pairs: Array<[boolean | undefined, number[]]> = [
      [e.ctrlKey, [UiohookKey.Ctrl, UiohookKey.CtrlRight]],
      [e.shiftKey, [UiohookKey.Shift, UiohookKey.ShiftRight]],
      [e.altKey, [UiohookKey.Alt, UiohookKey.AltRight]],
      [e.metaKey, [UiohookKey.Meta, UiohookKey.MetaRight]],
    ];
    for (const [down, codes] of pairs) {
      if (down === false) codes.forEach((code) => this.pressedKeys.delete(code));
    }
  }

  getToggleShortcut(): string { return this.toggleShortcut; }
  getHoldShortcut(): string { return this.holdShortcut; }
  setToggleShortcut(s: string) { this.toggleShortcut = s; }
  setHoldShortcut(s: string) { this.holdShortcut = s; }

  parseShortcutToKeyCodes(shortcut: string): ParsedShortcut {
    const parts = shortcut.split('+').map(p => p.trim());
    let requiresMeta = false;
    let requiresCtrl = false;
    let requiresAlt = false;
    let requiresShift = false;
    let key: number | null = null;

    log.debug(`Parsing shortcut: "${shortcut}" → parts:`, parts);

    for (const part of parts) {
      const upperPart = part.toUpperCase();
      switch (upperPart) {
        case 'COMMAND':
        case 'CMD':
          requiresMeta = true;
          break;
        case 'CTRL':
        case 'CONTROL':
          requiresCtrl = true;
          break;
        case 'ALT':
          requiresAlt = true;
          break;
        case 'SHIFT':
          requiresShift = true;
          break;
        case 'SPACE':
          key = UiohookKey.Space;
          break;
        case 'RETURN':
        case 'ENTER':
          key = UiohookKey.Enter;
          break;
        case 'ESCAPE':
        case 'ESC':
          key = UiohookKey.Escape;
          break;
        case 'BACKSPACE':
          key = UiohookKey.Backspace;
          break;
        case 'DELETE':
          key = UiohookKey.Delete;
          break;
        case 'TAB':
          key = UiohookKey.Tab;
          break;
        case 'CAPSLOCK':
          key = UiohookKey.CapsLock;
          break;
        case 'NUMLOCK':
          key = UiohookKey.NumLock;
          break;
        case 'SCROLLLOCK':
          key = UiohookKey.ScrollLock;
          break;
        case 'GLOBE':
        case 'FN':
          key = 179;
          log.info('Globe/Fn key selected - keycode 179.');
          break;
        case 'INSERT':
          key = UiohookKey.Insert;
          break;
        case 'HOME':
          key = UiohookKey.Home;
          break;
        case 'PAGEUP':
          key = UiohookKey.PageUp;
          break;
        case 'PAGEDOWN':
          key = UiohookKey.PageDown;
          break;
        case 'END':
          key = UiohookKey.End;
          break;
        case 'PRINTSCREEN':
        case 'PRINT':
          key = UiohookKey.PrintScreen;
          break;
        case 'UP':
        case 'ARROWUP':
          key = UiohookKey.ArrowUp;
          break;
        case 'DOWN':
        case 'ARROWDOWN':
          key = UiohookKey.ArrowDown;
          break;
        case 'LEFT':
        case 'ARROWLEFT':
          key = UiohookKey.ArrowLeft;
          break;
        case 'RIGHT':
        case 'ARROWRIGHT':
          key = UiohookKey.ArrowRight;
          break;
        default:
          if (/^F(\d+)$/.test(upperPart)) {
            const fNum = parseInt(upperPart.substring(1));
            const keyCode = (UiohookKey as any)[`F${fNum}`];
            if (keyCode !== undefined) {
              key = keyCode;
            }
          } else if (/^[0-9]$/.test(part)) {
            const keyCode = (UiohookKey as any)[part];
            if (keyCode !== undefined) {
              key = keyCode;
            }
          } else if (/^[A-Z]$/i.test(part)) {
            const char = part.toUpperCase();
            const keyCode = (UiohookKey as any)[char];
            if (keyCode !== undefined) {
              key = keyCode;
            } else {
              log.warn(`Could not find keycode for letter: ${char}`);
            }
          } else if (part.length === 1) {
            log.warn(`Unrecognized single character key: "${part}"`);
          }
          break;
      }
    }

    log.debug(`Parsed result:`, { requiresMeta, requiresCtrl, requiresAlt, requiresShift, key });
    return { requiresMeta, requiresCtrl, requiresAlt, requiresShift, key };
  }

  private checkModifiers(shortcutKeys: ParsedShortcut): boolean {
    const metaPressed = this.pressedKeys.has(UiohookKey.Meta) ||
                        this.pressedKeys.has(UiohookKey.MetaRight);
    const ctrlPressed = this.pressedKeys.has(UiohookKey.Ctrl) ||
                        this.pressedKeys.has(UiohookKey.CtrlRight);
    const altPressed = this.pressedKeys.has(UiohookKey.Alt) ||
                       this.pressedKeys.has(UiohookKey.AltRight);
    const shiftPressed = this.pressedKeys.has(UiohookKey.Shift) ||
                         this.pressedKeys.has(UiohookKey.ShiftRight);

    return (shortcutKeys.requiresMeta === metaPressed) &&
           (shortcutKeys.requiresCtrl === ctrlPressed) &&
           (shortcutKeys.requiresAlt === altPressed) &&
           (shortcutKeys.requiresShift === shiftPressed);
  }

  refresh() {
    log.debug(`Refreshing shortcuts. Toggle: "${this.toggleShortcut}", Hold: "${this.holdShortcut}"`);

    try {
      uIOhook.stop();
    } catch (e) { }
    this.holdGuard.start();

    const toggleKeys = this.toggleShortcut ? this.parseShortcutToKeyCodes(this.toggleShortcut) : null;
    const holdKeys = this.holdShortcut ? this.parseShortcutToKeyCodes(this.holdShortcut) : null;

    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');

    uIOhook.on('keydown', (e: any) => {
      // During paste mode, ignore keys our own input generates
      if (this.inPasteMode && isSynthesizedKey(e.keycode)) return;

      this.reconcileModifiers(e);
      this.pressedKeys.add(e.keycode);

      if (toggleKeys && toggleKeys.key !== null && e.keycode === toggleKeys.key) {
        if (!this.isTogglePressed && this.checkModifiers(toggleKeys)) {
          this.isTogglePressed = true;
          log.info('Toggle shortcut triggered');
          const win = this.getMainWindow();
          if (win) win.webContents.send('toggle-recording');
        }
      }

      if (holdKeys && holdKeys.key !== null && e.keycode === holdKeys.key) {
        if (!this.isHoldPressed && this.checkModifiers(holdKeys)) {
          this.isHoldPressed = true;
          this.holdGuard.activate(holdKeys.key);
          log.info('Hold shortcut pressed - starting recording');
          const win = this.getMainWindow();
          if (win) win.webContents.send('start-recording');
        }
      }
    });

    uIOhook.on('keyup', (e: any) => {
      // During paste mode, ignore keys our own input generates
      if (this.inPasteMode && isSynthesizedKey(e.keycode)) return;

      this.reconcileModifiers(e);
      this.pressedKeys.delete(e.keycode);

      if (toggleKeys && toggleKeys.key !== null && e.keycode === toggleKeys.key) {
        this.isTogglePressed = false;
      }

      // With the guard running, only its report counts: a typed "x" can't end the hold
      if (holdKeys && holdKeys.key !== null && e.keycode === holdKeys.key && !this.holdGuard.available) {
        this.releaseHold();
      }
    });

    try {
      uIOhook.start();
    } catch (error) {
      log.error('Failed to start uIOhook', error);
    }
  }

  stop() {
    this.holdGuard.stop();
    try {
      uIOhook.stop();
    } catch (e) {
      log.info('Error stopping uiohook:', e);
    }
  }
}
