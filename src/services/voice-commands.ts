/**
 * Spoken commands recognized at the *end* of a finalized phrase.
 * "Write the report. Press enter." → text "Write the report." + Enter key.
 * Mid-sentence uses ("I'll press enter later") are left as normal text.
 */

export type VoiceCommand = 'enter';

// Trailing "press enter", allowing Deepgram's punctuation/casing around it
const TRAILING_ENTER = /(^|[\s,.;:!?-])press[\s,]+enter[\s.,;:!?]*$/i;

// While a phrase is still being heard, hold back a trailing "press" / "press enter" so the
// command words aren't typed and then erased.
const TRAILING_COMMAND_PREFIX = /(^|\s)press(?:[\s,]+enter)?[\s.,;:!?]*$/i;

export function parseTrailingCommand(text: string): { text: string; command: VoiceCommand | null } {
  const match = text.match(TRAILING_ENTER);
  if (!match || match.index === undefined) {
    return { text, command: null };
  }
  // Keep the leading separator's punctuation (e.g. the "." in "done. Press enter")
  const kept = text.slice(0, match.index + match[1].length);
  // Drop whitespace and dangling clause punctuation left before the command ("Okay, press enter")
  const cleaned = kept.replace(/[\s,;:-]+$/, '');
  return { text: cleaned, command: 'enter' };
}

/** Text to show for an in-progress phrase: everything except a possible command being spoken. */
export function holdBackCommandPrefix(text: string): string {
  const match = text.match(TRAILING_COMMAND_PREFIX);
  if (!match || match.index === undefined) return text;
  return text.slice(0, match.index + match[1].length).replace(/\s+$/, '');
}

/**
 * Build the saved transcript from finalized phrases: commands are removed and an
 * Enter becomes a line break.
 */
export function joinWithCommands(finals: string[], commandsEnabled: boolean): string {
  let result = '';
  let needsSeparator = false;
  for (const phrase of finals) {
    const { text, command } = commandsEnabled ? parseTrailingCommand(phrase) : { text: phrase, command: null };
    if (text) {
      result += (needsSeparator ? ' ' : '') + text;
      needsSeparator = true;
    }
    if (command === 'enter') {
      result += '\n';
      needsSeparator = false;
    }
  }
  return result.replace(/\n+$/, '');
}
