const { execSync } = require('child_process');
const { clipboard } = require('electron');
import log from '../utils/logger';

// How long the target app gets to read the clipboard before we put the user's content back
const CLIPBOARD_RESTORE_DELAY_MS = 250;

type SavedClipboard = {
  text: string;
  html: string;
  rtf: string;
  image?: Electron.NativeImage;
};

let nutConfigured = false;

// nut-js is loaded lazily so tests and non-input code paths don't need the native module
function nut() {
  const lib = require('@nut-tree-fork/nut-js');
  if (!nutConfigured) {
    lib.keyboard.config.autoDelayMs = 0;
    nutConfigured = true;
  }
  return lib;
}

export class PasteService {
  // Restore is deferred so the paste keystroke itself is quick; a burst of pastes shares
  // one saved copy of the user's clipboard and restores it once at the end.
  private pendingRestore: { saved: SavedClipboard; pasted: string; timer: NodeJS.Timeout } | null = null;

  /**
   * Paste text via clipboard + Ctrl/Cmd+V simulation. Returns right after the keystroke;
   * the user's clipboard is restored shortly afterwards.
   * @param text - The text to paste.
   * @param heldModifiers - Modifier keys already physically held (e.g. during push-to-talk).
   *   When provided, avoids re-pressing/releasing modifiers the user is holding, preventing
   *   OS-level state corruption that would turn held hotkey keys into literal typed characters.
   */
  async paste(text: string, heldModifiers?: { ctrlHeld?: boolean; shiftHeld?: boolean; altHeld?: boolean; metaHeld?: boolean }): Promise<void> {
    try {
      let saved: SavedClipboard;
      if (this.pendingRestore) {
        clearTimeout(this.pendingRestore.timer);
        saved = this.pendingRestore.saved;
        this.pendingRestore = null;
      } else {
        saved = this.saveClipboard();
      }

      // Use Electron's clipboard API for proper Unicode support across all platforms
      clipboard.writeText(text);

      // Small delay to ensure clipboard is ready
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Simulate Cmd+V (macOS) or Ctrl+V (others)
      if (process.platform === 'darwin') {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else if (process.platform === 'win32') {
        // Use nut-js for fast native key simulation (avoids ~500ms PowerShell spawn)
        const { keyboard, Key } = nut();

        if (heldModifiers?.ctrlHeld) {
          // Ctrl is already physically held by the user (push-to-talk hotkey).
          // Only simulate V press/release — Ctrl is already down at the OS level,
          // so this still triggers Ctrl+V without corrupting the modifier state.
          await keyboard.pressKey(Key.V);
          await keyboard.releaseKey(Key.V);
        } else {
          await keyboard.pressKey(Key.LeftControl, Key.V);
          await keyboard.releaseKey(Key.LeftControl, Key.V);
        }
      } else {
        // Linux - use xdotool if available
        try {
          execSync('xdotool key ctrl+v');
        } catch {
          log.warn('xdotool not available on Linux. Text copied to clipboard but not pasted.');
        }
      }

      const timer = setTimeout(() => {
        this.pendingRestore = null;
        this.restoreClipboard(saved, text);
      }, CLIPBOARD_RESTORE_DELAY_MS);
      this.pendingRestore = { saved, pasted: text, timer };
    } catch (error) {
      log.error('Paste error:', error);
      throw error;
    }
  }

  /** Type plain keyboard characters as keystrokes (used for live typing). */
  async typeText(text: string): Promise<void> {
    if (!text) return;
    await nut().keyboard.type(text);
  }

  async pressBackspace(count: number): Promise<void> {
    const { keyboard, Key } = nut();
    for (let i = 0; i < count; i++) {
      await keyboard.pressKey(Key.Backspace);
      await keyboard.releaseKey(Key.Backspace);
    }
  }

  async pressEnter(): Promise<void> {
    const { keyboard, Key } = nut();
    await keyboard.pressKey(Key.Enter);
    await keyboard.releaseKey(Key.Enter);
  }

  /** Foreground window identity, used to stop correcting text if the user switches windows. */
  async getActiveWindowId(): Promise<string | null> {
    try {
      const win = await nut().getActiveWindow();
      const handle = (win as any)?.windowHandle;
      return handle === undefined || handle === null ? null : String(handle);
    } catch (error) {
      log.debug('Could not read active window:', error);
      return null;
    }
  }

  private saveClipboard(): SavedClipboard {
    const image = clipboard.readImage();
    return {
      text: clipboard.readText(),
      html: clipboard.readHTML(),
      rtf: clipboard.readRTF(),
      image: image.isEmpty() ? undefined : image,
    };
  }

  // Put back what the user had copied — unless they copied something new in the meantime
  private restoreClipboard(saved: SavedClipboard, pasted: string): void {
    if (clipboard.readText() !== pasted) return;
    if (!saved.text && !saved.html && !saved.rtf && !saved.image) {
      clipboard.clear();
      return;
    }
    clipboard.write({
      text: saved.text || undefined,
      html: saved.html || undefined,
      rtf: saved.rtf || undefined,
      image: saved.image,
    });
  }
}
