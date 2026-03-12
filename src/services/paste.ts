const { execSync } = require('child_process');
const { clipboard } = require('electron');
import log from '../utils/logger';

export class PasteService {
  // Type a chunk of text directly via keyboard simulation (no clipboard)
  async typeText(text: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        const { keyboard } = require('@nut-tree-fork/nut-js');
        keyboard.config.autoDelayMs = 0;
        await keyboard.type(text);
      } else if (process.platform === 'darwin') {
        // Use clipboard + paste for each chunk on macOS (AppleScript typing is unreliable for Unicode)
        clipboard.writeText(text);
        await new Promise((resolve) => setTimeout(resolve, 5));
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else {
        execSync(`xdotool type --clearmodifiers -- ${JSON.stringify(text)}`);
      }
    } catch (error) {
      log.error('TypeText error:', error);
      throw error;
    }
  }

  async paste(text: string): Promise<void> {
    try {
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
        await keyboard.pressKey(Key.LeftControl, Key.V);
        await keyboard.releaseKey(Key.LeftControl, Key.V);
      } else {
        // Linux - use xdotool if available
        try {
          execSync('xdotool key ctrl+v');
        } catch {
          log.warn('xdotool not available on Linux. Text copied to clipboard but not pasted.');
        }
      }
    } catch (error) {
      log.error('Paste error:', error);
      throw error;
    }
  }
}
