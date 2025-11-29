const { execSync } = require('child_process');

export class PasteService {
  async paste(text: string): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        // macOS - use pbcopy
        const buffer = Buffer.from(text, 'utf8');
        execSync('pbcopy', { input: buffer });
      } else if (process.platform === 'win32') {
        // Windows - use clip via stdin to avoid command injection
        const buffer = Buffer.from(text, 'utf8');
        execSync('powershell.exe -Command "$input | Set-Clipboard"', {
          input: buffer,
          encoding: 'utf8',
        });
      } else {
        // Linux - use xclip if available, otherwise try xsel
        try {
          const buffer = Buffer.from(text, 'utf8');
          execSync('xclip -selection clipboard', { input: buffer });
        } catch {
          // Fallback to xsel
          const buffer = Buffer.from(text, 'utf8');
          execSync('xsel --clipboard --input', { input: buffer });
        }
      }

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
          console.warn('xdotool not available on Linux. Text copied to clipboard but not pasted.');
        }
      }
    } catch (error) {
      console.error('Paste error:', error);
      throw error;
    }
  }
}
