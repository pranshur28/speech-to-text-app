import log from '../utils/logger';
import { isEnterCommand, mightBeEnterCommand } from './voice-commands';

/**
 * Types Deepgram's transcript into the focused app *as it is heard*, correcting earlier
 * guesses in place. Each utterance ("segment") starts with interim guesses that Deepgram
 * keeps revising; when it is finalized, the text is locked and a new segment begins.
 *
 * Safety rules:
 * - Only ever erases characters it typed itself in the current segment.
 * - If the foreground window changes mid-segment, stops touching that segment.
 * - Never sends keystrokes while the user is physically holding a modifier
 *   (that would turn letters into app shortcuts like Ctrl+A); it waits for release.
 */

export interface HeldModifiers {
  ctrlHeld: boolean;
  shiftHeld: boolean;
  altHeld: boolean;
  metaHeld: boolean;
}

export interface LiveTyperDeps {
  /** Run synthetic input exclusively; receives the modifiers physically held right now. */
  runInput<T>(fn: (held: HeldModifiers) => Promise<T>): Promise<T>;
  /** Type plain keyboard characters. */
  typeText(text: string): Promise<void>;
  /** Insert characters a keyboard can't type (symbols, accents, newlines) via the clipboard. */
  pasteText(text: string): Promise<void>;
  pressBackspace(count: number): Promise<void>;
  pressEnter(): Promise<void>;
  /** Identifier of the foreground window, or null if unknown. */
  getActiveWindowId(): Promise<string | null>;
  /** Dictionary replacements. */
  transform(text: string): string;
  /** Spoken phrase that presses Enter when said on its own, or null when voice commands are off. */
  enterPhrase: string | null;
  sleep?(ms: number): Promise<void>;
}

interface QueueItem {
  text: string;
  isFinal: boolean;
}

// Printable ASCII is typed as keystrokes; everything else (incl. newlines, which would
// press Enter and send messages in chat apps) goes through the clipboard.
const TYPABLE = /^[\x20-\x7E]$/;

const MODIFIER_RETRY_MS = 40;

/** Smallest edit turning what's on screen into the target: erase the differing tail, type the rest. */
export function diffEdit(onScreen: string, target: string): { backspaces: number; insert: string } {
  // Compare by code point so surrogate pairs are never split
  const a = Array.from(onScreen);
  const b = Array.from(target);
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) {
    common++;
  }
  return { backspaces: a.length - common, insert: b.slice(common).join('') };
}

/** Split text into runs of keyboard-typable characters and runs that need the clipboard. */
export function splitTypable(text: string): Array<{ text: string; typable: boolean }> {
  const runs: Array<{ text: string; typable: boolean }> = [];
  for (const char of Array.from(text)) {
    const typable = TYPABLE.test(char);
    const last = runs[runs.length - 1];
    if (last && last.typable === typable) {
      last.text += char;
    } else {
      runs.push({ text: char, typable });
    }
  }
  return runs;
}

function anyHeld(held: HeldModifiers): boolean {
  return held.ctrlHeld || held.shiftHeld || held.altHeld || held.metaHeld;
}

export class LiveTyper {
  private onScreen = '';
  // Phrases are separated by a space typed at the start of the *next* phrase, so an
  // Enter command or the end of dictation never leaves a trailing space behind.
  private needsSeparator = false;
  private windowId: string | null | undefined = undefined; // undefined = not captured yet
  private detached = false;
  private queue: QueueItem[] = [];
  private inFlight: QueueItem | null = null;
  private running: Promise<void> | null = null;
  private generation = 0;

  constructor(private deps: LiveTyperDeps) {}

  /** Feed a transcript update for the current segment. */
  update(text: string, isFinal: boolean): void {
    const last = this.queue[this.queue.length - 1];
    // Collapse a run of interim guesses into the newest one — only the latest matters
    if (last && !last.isFinal && last !== this.inFlight) {
      this.queue[this.queue.length - 1] = { text, isFinal };
    } else {
      this.queue.push({ text, isFinal });
    }
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    }
  }

  /** Resolves once everything queued has been typed. */
  async flush(): Promise<void> {
    while (this.running) {
      await this.running;
    }
  }

  /** Forget the current segment and anything queued (text already typed stays). */
  reset(): void {
    this.generation++;
    this.queue = [];
    this.inFlight = null;
    this.needsSeparator = false;
    this.resetSegment();
  }

  private resetSegment(): void {
    this.onScreen = '';
    this.windowId = undefined;
    this.detached = false;
  }

  private sleep(ms: number): Promise<void> {
    return this.deps.sleep ? this.deps.sleep(ms) : new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async drain(): Promise<void> {
    const generation = this.generation;
    while (this.queue.length > 0 && generation === this.generation) {
      const item = this.queue[0];
      this.inFlight = item;
      let done = false;
      try {
        done = await this.apply(item);
      } catch (err) {
        log.error('Live typing failed:', err);
        done = true; // don't retry forever on an input error
      }
      if (generation !== this.generation) return;
      this.inFlight = null;
      if (!done) {
        // Modifier held — wait, then retry with whatever is newest by then
        await this.sleep(MODIFIER_RETRY_MS);
        continue;
      }
      this.queue.shift();
      if (item.isFinal) this.resetSegment();
    }
  }

  /** What should be on screen for this phrase, and whether to press Enter after it. */
  private plan(item: QueueItem): { target: string; pressEnter: boolean } {
    let text = item.text;
    let pressEnter = false;
    const phrase = this.deps.enterPhrase;
    if (phrase) {
      if (item.isFinal && isEnterCommand(text, phrase)) {
        // The whole utterance was the command: type nothing, press Enter
        text = '';
        pressEnter = true;
      } else if (!item.isFinal && mightBeEnterCommand(text, phrase)) {
        // Could still turn out to be the command — don't type it yet
        text = '';
      }
    }
    text = this.deps.transform(text);
    const separator = this.needsSeparator && text ? ' ' : '';
    return { target: separator + text, pressEnter };
  }

  /** Returns false if it must be retried later (a modifier key is held). */
  private async apply(item: QueueItem): Promise<boolean> {
    if (this.detached) {
      // Text in this phrase was abandoned; the next phrase starts fresh where focus is now
      return true;
    }

    const { target, pressEnter } = this.plan(item);

    return this.deps.runInput(async (held) => {
      if (anyHeld(held)) return false;

      const activeWindow = await this.deps.getActiveWindowId();
      if (this.windowId === undefined) {
        this.windowId = activeWindow;
      } else if (activeWindow !== null && this.windowId !== null && activeWindow !== this.windowId) {
        log.warn('Foreground window changed mid-phrase; leaving the typed text as is');
        this.detached = true;
        return true;
      }

      const { backspaces, insert } = diffEdit(this.onScreen, target);
      if (backspaces > 0) await this.deps.pressBackspace(backspaces);
      for (const run of splitTypable(insert)) {
        if (run.typable) {
          await this.deps.typeText(run.text);
        } else {
          await this.deps.pasteText(run.text);
        }
      }
      this.onScreen = target;

      if (item.isFinal) {
        if (pressEnter) {
          await this.deps.pressEnter();
          this.needsSeparator = false;
        } else if (target) {
          this.needsSeparator = true;
        }
      }
      return true;
    });
  }
}
