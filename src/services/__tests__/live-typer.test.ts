jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.') } }));

import { LiveTyper, LiveTyperDeps, HeldModifiers, diffEdit, splitTypable } from '../live-typer';

const NONE: HeldModifiers = { ctrlHeld: false, shiftHeld: false, altHeld: false, metaHeld: false };

// A fake text box: applies typing, pasting and backspaces like a real editor would
function makeHarness(overrides: Partial<LiveTyperDeps> = {}) {
  const state = {
    screen: '',
    window: 'win-1',
    held: { ...NONE },
    ops: [] as string[],
  };
  const deps: LiveTyperDeps = {
    runInput: async (fn) => fn({ ...state.held }),
    typeText: async (text) => { state.screen += text; state.ops.push(`type:${text}`); },
    pasteText: async (text) => { state.screen += text; state.ops.push(`paste:${text}`); },
    pressBackspace: async (count) => {
      state.screen = Array.from(state.screen).slice(0, -count).join('');
      state.ops.push(`bs:${count}`);
    },
    pressEnter: async () => { state.screen += '⏎'; state.ops.push('enter'); },
    getActiveWindowId: async () => state.window,
    transform: (text) => text,
    commandsEnabled: true,
    sleep: () => new Promise((resolve) => setTimeout(resolve, 0)),
    ...overrides,
  };
  return { state, typer: new LiveTyper(deps) };
}

describe('diffEdit', () => {
  test('appends when the new text extends the old', () => {
    expect(diffEdit('hello', 'hello world')).toEqual({ backspaces: 0, insert: ' world' });
  });

  test('erases only the differing tail', () => {
    expect(diffEdit('I scream', 'ice cream')).toEqual({ backspaces: 8, insert: 'ice cream' });
    expect(diffEdit('the cat sat', 'the cat sang')).toEqual({ backspaces: 1, insert: 'ng' });
  });

  test('handles shrinking text', () => {
    expect(diffEdit('hello there', 'hello')).toEqual({ backspaces: 6, insert: '' });
  });

  test('never splits emoji or other surrogate pairs', () => {
    expect(diffEdit('a😀', 'a😃')).toEqual({ backspaces: 1, insert: '😃' });
  });
});

describe('splitTypable', () => {
  test('separates keyboard characters from symbols and newlines', () => {
    expect(splitTypable('K* is Σ\nok')).toEqual([
      { text: 'K* is ', typable: true },
      { text: 'Σ\n', typable: false },
      { text: 'ok', typable: true },
    ]);
  });
});

describe('LiveTyper', () => {
  test('types guesses as they arrive and corrects them in place', async () => {
    const { state, typer } = makeHarness();

    typer.update('I scream', false);
    await typer.flush();
    expect(state.screen).toBe('I scream');

    typer.update('ice cream is', false);
    await typer.flush();
    expect(state.screen).toBe('ice cream is');

    typer.update('Ice cream is great.', true);
    await typer.flush();
    expect(state.screen).toBe('Ice cream is great.');
  });

  test('locks a finalized phrase and starts the next one after it', async () => {
    const { state, typer } = makeHarness();

    typer.update('First phrase.', true);
    typer.update('second', false);
    typer.update('Second phrase.', true);
    await typer.flush();

    expect(state.screen).toBe('First phrase. Second phrase.');
    // Never erased anything from the first phrase
    expect(state.ops[0]).toBe('type:First phrase.');
    expect(state.ops.some((op) => op.startsWith('bs:'))).toBe(false);
  });

  test('never erases text that was there before dictation', async () => {
    const { state, typer } = makeHarness();
    state.screen = 'Existing text: ';

    typer.update('hello', false);
    typer.update('', false);
    await typer.flush();

    expect(state.screen).toBe('Existing text: ');
  });

  test('collapses a burst of guesses into the newest one', async () => {
    const { state, typer } = makeHarness();

    typer.update('a', false);
    typer.update('ab', false);
    typer.update('abc', false);
    typer.update('abcd', false);
    await typer.flush();

    expect(state.screen).toBe('abcd');
    expect(state.ops.length).toBeLessThanOrEqual(2);
  });

  test('pastes characters a keyboard cannot type', async () => {
    const { state, typer } = makeHarness({ transform: (t) => t.replace('kleene star', 'K* (Σ*)') });

    typer.update('the kleene star', true);
    await typer.flush();

    expect(state.screen).toBe('the K* (Σ*)');
    expect(state.ops).toEqual(['type:the K* (', 'paste:Σ', 'type:*)']);
  });

  test('waits while a modifier key is held, then types the latest text', async () => {
    const { state, typer } = makeHarness();
    state.held.ctrlHeld = true;

    typer.update('hello', false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(state.screen).toBe('');

    typer.update('hello world', false);
    state.held.ctrlHeld = false;
    await typer.flush();

    expect(state.screen).toBe('hello world');
    expect(state.ops).toEqual(['type:hello world']);
  });

  test('stops correcting a phrase if the user switches windows', async () => {
    const { state, typer } = makeHarness();

    typer.update('draft text', false);
    await typer.flush();

    state.window = 'win-2';
    typer.update('drafted text here', false);
    typer.update('Drafted text here.', true);
    await typer.flush();

    // Nothing was erased or typed after the switch
    expect(state.ops).toEqual(['type:draft text']);

    // The next phrase types normally in the new window
    typer.update('Next one.', true);
    await typer.flush();
    expect(state.ops[state.ops.length - 1]).toBe('type:Next one.');
  });

  test('reset starts a fresh session and leaves typed text alone', async () => {
    const { state, typer } = makeHarness();

    typer.update('kept', true);
    await typer.flush();
    typer.reset();
    typer.update('new', false);
    await typer.flush();

    // A new session doesn't assume it continues the previous text, so no separator
    expect(state.screen).toBe('keptnew');
  });

  describe('voice commands', () => {
    test('"press enter" at the end of a phrase is removed and presses Enter', async () => {
      const { state, typer } = makeHarness();

      typer.update('Ship it today', false);
      typer.update('Ship it today press', false);
      typer.update('Ship it today press enter', false);
      typer.update('Ship it today. Press enter.', true);
      await typer.flush();

      expect(state.screen).toBe('Ship it today.⏎');
      // The command words were never typed
      expect(state.ops.some((op) => /press/i.test(op))).toBe(false);
    });

    test('a standalone "press enter" just presses Enter, with no stray space', async () => {
      const { state, typer } = makeHarness();

      typer.update('Hello team.', true);
      typer.update('Press enter.', true);
      typer.update('Next message.', true);
      await typer.flush();

      expect(state.screen).toBe('Hello team.⏎Next message.');
    });

    test('mid-sentence "press enter" is typed as normal text', async () => {
      const { state, typer } = makeHarness();

      typer.update("I'll press enter later.", true);
      await typer.flush();

      expect(state.screen).toBe("I'll press enter later.");
      expect(state.ops).not.toContain('enter');
    });

    test('commands can be turned off', async () => {
      const { state, typer } = makeHarness({ commandsEnabled: false });

      typer.update('Done. Press enter.', true);
      await typer.flush();

      expect(state.screen).toBe('Done. Press enter.');
    });

    test('no Enter is pressed after switching windows mid-phrase', async () => {
      const { state, typer } = makeHarness();

      typer.update('message', false);
      await typer.flush();
      state.window = 'win-2';
      typer.update('Message. Press enter.', true);
      await typer.flush();

      expect(state.ops).not.toContain('enter');
    });
  });
});
