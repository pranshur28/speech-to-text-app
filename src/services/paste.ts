const { execSync } = require('child_process');
const { clipboard } = require('electron');
import log from '../utils/logger';

// How long the target app gets to read the clipboard before we put the user's content back
const CLIPBOARD_RESTORE_DELAY_MS = 250;

export class PasteService {
  /**
   * Paste text via clipboard + Ctrl/Cmd+V simulation.
   * @param text - The text to paste.
   * @param heldModifiers - Modifier keys already physically held (e.g. during push-to-talk).
   *   When provided, avoids re-pressing/releasing modifiers the user is holding, preventing
   *   OS-level state corruption that would turn held hotkey keys into literal typed characters.
   */
  async paste(text: string, heldModifiers?: { ctrlHeld?: boolean; shiftHeld?: boolean; altHeld?: boolean; metaHeld?: boolean }): Promise<void> {
    try {
      const saved = this.saveClipboard();

      // Use Electron's clipboard API for proper Unicode support across all platforms
      clipboard.writeText(text);

      // Small delay to ensure clipboard is ready
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Simulate Cmd+V (macOS) or Ctrl+V (others)
      if (process.platform === 'darwin') {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else if (process.platform === 'win32') {
        // Use nut-js for fast native key simulation (avoids ~500ms PowerShell spawn)
        const { keyboard, Key } = require('@nut-tree-fork/nut-js');

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

      await new Promise((resolve) => setTimeout(resolve, CLIPBOARD_RESTORE_DELAY_MS));
      this.restoreClipboard(saved, text);
    } catch (error) {
      log.error('Paste error:', error);
      throw error;
    }
  }

  private saveClipboard() {
    const image = clipboard.readImage();
    return {
      text: clipboard.readText(),
      html: clipboard.readHTML(),
      rtf: clipboard.readRTF(),
      image: image.isEmpty() ? undefined : image,
    };
  }

  // Put back what the user had copied — unless they copied something new in the meantime
  private restoreClipboard(saved: ReturnType<PasteService['saveClipboard']>, pasted: string): void {
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
