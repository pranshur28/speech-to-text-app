/**
 * Split a stored shortcut ("Ctrl+Shift+Space") into display keys for <kbd> chips.
 * "Command" is shown as "Win" on Windows and "⌘" on macOS.
 */
export function shortcutKeys(shortcut: string, platform: string = navigator.platform): string[] {
  if (!shortcut) return [];
  const isMac = /mac/i.test(platform);
  return shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (upper === 'COMMAND' || upper === 'CMD') return isMac ? '⌘' : 'Win';
      if (upper === 'CONTROL') return 'Ctrl';
      if (upper === 'ESCAPE') return 'Esc';
      if (upper === 'RETURN') return 'Enter';
      return part;
    });
}

/** Elapsed recording time as m:ss (or h:mm:ss past an hour). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Keep only the end of a long live transcript so the newest words stay visible. */
export function tailText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(text.length - maxChars);
  const firstSpace = cut.indexOf(' ');
  return '…' + (firstSpace > 0 && firstSpace < 20 ? cut.slice(firstSpace + 1) : cut);
}
