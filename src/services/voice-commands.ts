/**
 * Spoken "press Enter" command. To avoid accidental triggers it only counts when it is the
 * *entire* utterance — pause, say the phrase (default "period"), pause. Said inside a
 * sentence ("…every time, period.") it is typed as normal text.
 *
 * Recognition errors are tolerated (one letter off, e.g. "periods"), which is safe because
 * a lone mis-heard word is almost never intended text.
 */

export const DEFAULT_ENTER_PHRASE = 'period';

// Nova-3's dictation mode turns these spoken words into punctuation before we see them,
// so a lone "." must count as the command when the phrase is "period".
const DICTATED_SYMBOLS: Record<string, string> = {
  period: '.',
  comma: ',',
  colon: ':',
  questionmark: '?',
  exclamationmark: '!',
};

function isDictatedSymbol(utterance: string, phrase: string): boolean {
  const symbol = DICTATED_SYMBOLS[compact(phrase)];
  return !!symbol && utterance.trim() === symbol;
}

/** Lowercase letters/digits only, no spaces: "Sub-mit." → "submit". */
function compact(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return prev[b.length];
}

// Short phrases must match exactly; longer ones may be one letter off
function allowedErrors(phrase: string): number {
  return phrase.length >= 6 ? 1 : 0;
}

/** True if this whole utterance is the Enter command (allowing small mishearings). */
export function isEnterCommand(utterance: string, phrase: string): boolean {
  if (isDictatedSymbol(utterance, phrase)) return true;
  const said = compact(utterance);
  const target = compact(phrase);
  if (!said || !target) return false;
  return editDistance(said, target) <= allowedErrors(target);
}

/**
 * While an utterance is still being heard: could it turn out to be the command?
 * If so, live typing holds it back instead of typing then erasing it.
 */
export function mightBeEnterCommand(partialUtterance: string, phrase: string): boolean {
  if (isDictatedSymbol(partialUtterance, phrase)) return true;
  const said = compact(partialUtterance);
  const target = compact(phrase);
  if (!said || !target) return false;
  return target.startsWith(said) || isEnterCommand(partialUtterance, phrase);
}

/**
 * Build the saved transcript from finalized phrases: a command utterance becomes a line
 * break. Pass `phrase` null when voice commands are off.
 */
export function joinWithCommands(finals: string[], phrase: string | null): string {
  let result = '';
  let needsSeparator = false;
  for (const utterance of finals) {
    if (phrase && isEnterCommand(utterance, phrase)) {
      result += '\n';
      needsSeparator = false;
      continue;
    }
    if (utterance) {
      result += (needsSeparator ? ' ' : '') + utterance;
      needsSeparator = true;
    }
  }
  return result.replace(/\n+$/, '');
}
