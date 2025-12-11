const { execSync } = require('child_process');
const { clipboard } = require('electron');
import log from '../utils/logger';

export class PasteService {
  async paste(text: string): Promise<void> {
    try {
      // Use Electron's clipboard API for proper Unicode support across all platforms
      clipboard.writeText(text);

      // Small delay to ensure clipboard is ready
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate Cmd+V (macOS) or Ctrl+V (others)
      if (process.platform === 'darwin') {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else if (process.platform === 'win32') {
        execSync('powershell.exe -Command "[System.Windows.Forms.SendKeys]::SendWait(\\"^v\\")"');
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
