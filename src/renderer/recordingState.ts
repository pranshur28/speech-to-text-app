// Recording state machine
export type RecordingPhase = 'ready' | 'starting' | 'recording' | 'paused' | 'processing';

export interface RecordingState {
  phase: RecordingPhase;
  status: string;
  errorMessage: string | null;
}

export type RecordingAction =
  | { type: 'START_REQUESTED' }
  | { type: 'RECORDING_STARTED' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'DONE'; status?: string }
  | { type: 'ERROR'; status: string; errorMessage?: string | null }
  | { type: 'CANCEL' }
  | { type: 'DISMISS_ERROR' }
  | { type: 'RESET' };

export const initialRecordingState: RecordingState = {
  phase: 'ready',
  status: 'Ready',
  errorMessage: null,
};

export function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
  switch (action.type) {
    case 'START_REQUESTED':
      return { phase: 'starting', status: 'Starting...', errorMessage: null };
    case 'RECORDING_STARTED':
      return { phase: 'recording', status: 'Listening...', errorMessage: null };
    case 'PAUSE':
      return { ...state, phase: 'paused', status: 'Paused' };
    case 'RESUME':
      return { ...state, phase: 'recording', status: 'Listening...' };
    case 'STOP_PROCESSING':
      return { phase: 'processing', status: 'Finishing...', errorMessage: null };
    case 'DONE':
      return { phase: 'ready', status: action.status || 'Done', errorMessage: null };
    case 'ERROR':
      return { phase: 'ready', status: action.status, errorMessage: action.errorMessage ?? null };
    case 'CANCEL':
      return { phase: 'ready', status: 'Cancelled', errorMessage: null };
    case 'DISMISS_ERROR':
      return state.phase === 'ready' ? initialRecordingState : { ...state, errorMessage: null };
    case 'RESET':
      // Only reset status text if we're still in 'ready' phase.
      // A delayed RESET (from setTimeout) must not clobber an active recording,
      // and errors stay visible until dismissed or the next recording starts.
      if (state.phase !== 'ready' || state.errorMessage) return state;
      return initialRecordingState;
    default:
      return state;
  }
}
