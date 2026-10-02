import { initialRecordingState, recordingReducer, RecordingState } from '../recordingState';
import { toShortcutKey } from '../components/ShortcutRecorder';

describe('recordingReducer', () => {
  const recording: RecordingState = { phase: 'recording', status: 'Listening...', errorMessage: null };

  test('RESET does not clobber an active recording', () => {
    expect(recordingReducer(recording, { type: 'RESET' })).toBe(recording);
  });

  test('RESET clears a finished status', () => {
    const done = recordingReducer(recording, { type: 'DONE', status: 'Done' });
    expect(recordingReducer(done, { type: 'RESET' })).toEqual(initialRecordingState);
  });

  test('errors stay visible through RESET until dismissed', () => {
    const failed = recordingReducer(initialRecordingState, {
      type: 'ERROR', status: 'Error', errorMessage: 'Deepgram rejected the API key.',
    });
    expect(recordingReducer(failed, { type: 'RESET' })).toBe(failed);
    expect(recordingReducer(failed, { type: 'DISMISS_ERROR' })).toEqual(initialRecordingState);
  });

  test('starting a new recording clears the previous error', () => {
    const failed = recordingReducer(initialRecordingState, { type: 'ERROR', status: 'Error', errorMessage: 'x' });
    expect(recordingReducer(failed, { type: 'START_REQUESTED' }).errorMessage).toBeNull();
  });
});

describe('toShortcutKey', () => {
  test.each([
    [' ', 'Space'],
    ['NumLock', 'NumLock'],
    ['ArrowUp', 'Up'],
    ['k', 'K'],
    ['F9', 'F9'],
  ])('%p → %p', (domKey, expected) => {
    expect(toShortcutKey(domKey)).toBe(expected);
  });

  test('modifier-only presses return null', () => {
    expect(toShortcutKey('Control')).toBeNull();
    expect(toShortcutKey('Shift')).toBeNull();
  });
});
