import { holdBackCommandPrefix, joinWithCommands, parseTrailingCommand } from '../voice-commands';

describe('parseTrailingCommand', () => {
  test.each([
    ['Write the report. Press enter.', 'Write the report.'],
    ['Okay, press enter', 'Okay'],
    ['See you soon press enter!', 'See you soon'],
    ['Press enter.', ''],
    ['press Enter', ''],
    ['Done. Press, enter.', 'Done.'],
  ])('%p → text %p + Enter', (input, text) => {
    expect(parseTrailingCommand(input)).toEqual({ text, command: 'enter' });
  });

  test.each([
    "I'll press enter later.",
    'Press enter to continue the setup.',
    'The impress enter key',
    'Just a normal sentence.',
    'compress enter',
  ])('%p is not a command', (input) => {
    expect(parseTrailingCommand(input)).toEqual({ text: input, command: null });
  });
});

describe('holdBackCommandPrefix', () => {
  test.each([
    ['Hello there press', 'Hello there'],
    ['Hello there, press enter', 'Hello there,'],
    ['press', ''],
    ['Hello there', 'Hello there'],
    ['I need to impress', 'I need to impress'],
  ])('%p → %p', (input, expected) => {
    expect(holdBackCommandPrefix(input)).toBe(expected);
  });
});

describe('joinWithCommands', () => {
  test('turns Enter commands into line breaks', () => {
    expect(joinWithCommands(['Hi team.', 'Ship it today. Press enter.', 'Next message.'], true))
      .toBe('Hi team. Ship it today.\nNext message.');
  });

  test('a standalone command ends the line', () => {
    expect(joinWithCommands(['First.', 'Press enter.', 'Second.', 'Press enter.'], true))
      .toBe('First.\nSecond.');
  });

  test('leaves text untouched when commands are disabled', () => {
    expect(joinWithCommands(['Hello.', 'Press enter.'], false)).toBe('Hello. Press enter.');
  });
});
