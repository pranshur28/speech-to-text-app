import { uIOhook, UiohookKey } from 'uiohook-napi';
import { BrowserWindow } from 'electron';
import log from '../utils/logger';

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

  // Paste mode: when true, ignore synthetic key events from paste simulation
  private inPasteMode = false;
  private pressedKeysSnapshot: Set<number> | null = null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  /**
   * Enter paste mode: freezes pressedKeys tracking so synthetic Ctrl+V events
   * from nut-js don't corrupt the hotkey state.
   * Returns which modifier keys are currently physically held.
   */
  enterPasteMode(): { ctrlHeld: boolean; shiftHeld: boolean; altHeld: boolean; metaHeld: boolean } {
    this.inPasteMode = true;
    this.pressedKeysSnapshot = new Set(this.pressedKeys);
    return {
      ctrlHeld: this.pressedKeys.has(UiohookKey.Ctrl) || this.pressedKeys.has(UiohookKey.CtrlRight),
      shiftHeld: this.pressedKeys.has(UiohookKey.Shift) || this.pressedKeys.has(UiohookKey.ShiftRight),
      altHeld: this.pressedKeys.has(UiohookKey.Alt) || this.pressedKeys.has(UiohookKey.AltRight),
      metaHeld: this.pressedKeys.has(UiohookKey.Meta) || this.pressedKeys.has(UiohookKey.MetaRight),
    };
  }

  /**
   * Exit paste mode: restores pressedKeys to the pre-paste snapshot so hotkey
   * detection continues accurately.
   */
  exitPasteMode(): void {
    if (this.pressedKeysSnapshot) {
      this.pressedKeys = this.pressedKeysSnapshot;
      this.pressedKeysSnapshot = null;
    }
    this.inPasteMode = false;
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
            const keyCode = (UiohookKey as any)[`Digit${part}`];
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

    const toggleKeys = this.toggleShortcut ? this.parseShortcutToKeyCodes(this.toggleShortcut) : null;
    const holdKeys = this.holdShortcut ? this.parseShortcutToKeyCodes(this.holdShortcut) : null;

    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');

    uIOhook.on('keydown', (e: any) => {
      // During paste mode, ignore all key events to prevent synthetic
      // Ctrl+V keystrokes from corrupting hotkey tracking state
      if (this.inPasteMode) return;

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
          log.info('Hold shortcut pressed - starting recording');
          const win = this.getMainWindow();
          if (win) win.webContents.send('start-recording');
        }
      }
    });

    uIOhook.on('keyup', (e: any) => {
      // During paste mode, ignore all key events to prevent synthetic
      // Ctrl+V keystrokes from corrupting hotkey tracking state
      if (this.inPasteMode) return;

      this.pressedKeys.delete(e.keycode);

      if (toggleKeys && toggleKeys.key !== null && e.keycode === toggleKeys.key) {
        this.isTogglePressed = false;
      }

      if (holdKeys && holdKeys.key !== null && e.keycode === holdKeys.key) {
        if (this.isHoldPressed) {
          this.isHoldPressed = false;
          log.info('Hold shortcut released - stopping recording');
          const win = this.getMainWindow();
          if (win) win.webContents.send('stop-recording');
        }
      }
    });

    try {
      uIOhook.start();
    } catch (error) {
      log.error('Failed to start uIOhook', error);
    }
  }

  stop() {
    try {
      uIOhook.stop();
    } catch (e) {
      log.info('Error stopping uiohook:', e);
    }
  }
}
