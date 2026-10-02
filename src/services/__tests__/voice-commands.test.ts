import { isEnterCommand, joinWithCommands, mightBeEnterCommand } from '../voice-commands';

describe('isEnterCommand', () => {
  test.each(['Submit.', 'submit', 'Submit!', 'Sub mit.', 'Summit.', 'Submits.'])(
    '%p alone presses Enter',
    (utterance) => {
      expect(isEnterCommand(utterance, 'submit')).toBe(true);
    }
  );

  test.each([
    'Please submit the form.',
    'Submit the report today.',
    'Submitted.',
    'Commit.',
    'Okay.',
    '',
  ])('%p is not the command', (utterance) => {
    expect(isEnterCommand(utterance, 'submit')).toBe(false);
  });

  test('works with a custom multi-word phrase and its common mishearings', () => {
    expect(isEnterCommand('Press enter.', 'press enter')).toBe(true);
    expect(isEnterCommand('Presenter.', 'press enter')).toBe(true);
    expect(isEnterCommand('Press center.', 'press enter')).toBe(true);
    expect(isEnterCommand('I will press enter.', 'press enter')).toBe(false);
  });

  test('short phrases must match exactly', () => {
    expect(isEnterCommand('Send.', 'send')).toBe(true);
    expect(isEnterCommand('Sent.', 'send')).toBe(false);
  });
});

describe('"period" (default phrase)', () => {
  test.each(['Period.', 'period', 'Periods.'])('%p alone presses Enter', (utterance) => {
    expect(isEnterCommand(utterance, 'period')).toBe(true);
  });

  test('a lone "." counts, because Nova-3 dictation turns spoken "period" into punctuation', () => {
    expect(isEnterCommand('.', 'period')).toBe(true);
    expect(isEnterCommand(' . ', 'period')).toBe(true);
    expect(mightBeEnterCommand('.', 'period')).toBe(true);
  });

  test.each([
    'Yeah. Set it every time and you heard it right every time, period.',
    'That is unique, period.',
    'The period ends tomorrow.',
  ])('%p is typed as text', (utterance) => {
    expect(isEnterCommand(utterance, 'period')).toBe(false);
  });

  test('a lone "." does not count for other phrases', () => {
    expect(isEnterCommand('.', 'submit')).toBe(false);
  });
});

describe('mightBeEnterCommand', () => {
  test.each(['Sub', 'Subm', 'Submit', 'Summit'])('%p could still be the command', (partial) => {
    expect(mightBeEnterCommand(partial, 'submit')).toBe(true);
  });

  test.each(['Sure', 'Subway', 'Please', 'Submit the'])('%p is clearly not', (partial) => {
    expect(mightBeEnterCommand(partial, 'submit')).toBe(false);
  });
});

describe('joinWithCommands', () => {
  test('a command utterance becomes a line break', () => {
    expect(joinWithCommands(['Hi team.', 'Ship it today.', 'Submit.', 'Next message.'], 'submit'))
      .toBe('Hi team. Ship it today.\nNext message.');
  });

  test('trailing command leaves no empty line', () => {
    expect(joinWithCommands(['First.', 'Submit.'], 'submit')).toBe('First.');
  });

  test('leaves text untouched when commands are off', () => {
    expect(joinWithCommands(['Hello.', 'Submit.'], null)).toBe('Hello. Submit.');
  });
});
