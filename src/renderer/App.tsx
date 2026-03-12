import React, { useState, useRef, useEffect, useReducer } from 'react';
import './styles.css';
import { SearchView } from './SearchView';
import TabBar, { TabType } from './components/TabBar';
import PersistentHeader, { RecordingStatus } from './components/PersistentHeader';
import ContextualFooter from './components/ContextualFooter';
import { DictionarySettings } from './components/DictionarySettings';
import * as Switch from '@radix-ui/react-switch';

interface Transcription {
  id: number;
  raw_text: string;
  formatted_text: string;
  timestamp: number;
  formatting_profile: string;
  is_favorite: number;
  created_at: number;
}

// Recording state machine
type RecordingPhase = 'ready' | 'starting' | 'recording' | 'paused' | 'processing';

interface RecordingState {
  phase: RecordingPhase;
  status: string;
  errorMessage: string | null;
}

type RecordingAction =
  | { type: 'START_REQUESTED' }
  | { type: 'RECORDING_STARTED' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'DONE'; status?: string }
  | { type: 'ERROR'; status: string; errorMessage?: string | null }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
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
      return { phase: 'processing', status: 'Thinking...', errorMessage: null };
    case 'DONE':
      return { phase: 'ready', status: action.status || 'Done', errorMessage: null };
    case 'ERROR':
      return { phase: 'ready', status: action.status, errorMessage: action.errorMessage ?? null };
    case 'CANCEL':
      return { phase: 'ready', status: 'Cancelled', errorMessage: null };
    case 'RESET':
      // Only reset status text if we're still in 'ready' phase.
      // A delayed RESET (from setTimeout) must not clobber an active recording.
      if (state.phase !== 'ready') return state;
      return { phase: 'ready', status: 'Ready', errorMessage: null };
    default:
      return state;
  }
}

export default function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('recording');
  // Helper to map DOM keys to Electron Accelerators
  const getElectronAccelerator = (e: KeyboardEvent): string | null => {
    const key = e.key.toUpperCase();

    // Modifiers are handled separately in the main logic,
    // this function returns the "trigger" key if present.
    if (['CONTROL', 'META', 'ALT', 'SHIFT'].includes(key)) return null;

    const map: { [key: string]: string } = {
      ' ': 'Space',
      'ARROWUP': 'Up',
      'ARROWDOWN': 'Down',
      'ARROWLEFT': 'Left',
      'ARROWRIGHT': 'Right',
      'ESCAPE': 'Esc',
      'RETURN': 'Return',
      'ENTER': 'Return',
      'BACKSPACE': 'Backspace',
      'DELETE': 'Delete',
      'TAB': 'Tab',
      'CAPSLOCK': 'CapsLock',
      'NUMARIALOCK': 'NumLock',
      'SCROLLLOCK': 'ScrollLock',
      'PAUSE': 'Pause',
      'INSERT': 'Insert',
      'HOME': 'Home',
      'PAGEUP': 'PageUp',
      'PAGEDOWN': 'PageDown',
      'END': 'End',
      'PRINT': 'PrintScreen',
    };

    if (map[key]) return map[key];

    // For letters and numbers, return uppercase
    if (key.length === 1) return key;

    // Function keys
    if (/^F\d+$/.test(key)) return key;

    // Fallback
    return key;
  };

  // Recording state machine
  const [recState, dispatch] = useReducer(recordingReducer, {
    phase: 'ready',
    status: 'Ready',
    errorMessage: null,
  });
  const stateRef = useRef(recState);
  useEffect(() => { stateRef.current = recState; }, [recState]);

  // Derive booleans for JSX compatibility
  const isRecording = recState.phase === 'recording' || recState.phase === 'paused';
  const isPaused = recState.phase === 'paused';
  const isProcessing = recState.phase === 'processing';
  const status = recState.status;
  const errorMessage = recState.errorMessage;

  // Live transcript from Deepgram while recording
  const [liveTranscript, setLiveTranscript] = useState('');
  const finalsTextRef = useRef('');

  const [recentTranscriptions, setRecentTranscriptions] = useState<Transcription[]>([]);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [apiKeySaveMessage, setApiKeySaveMessage] = useState('');

  // Deepgram API Key State
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [deepgramSaveStatus, setDeepgramSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [deepgramSaveMessage, setDeepgramSaveMessage] = useState('');

  // Settings State
  const [pushToTalk, setPushToTalk] = useState(() => {
    const saved = localStorage.getItem('pushToTalk');
    return saved ? JSON.parse(saved) : false;
  });
  const [toggleShortcut, setToggleShortcut] = useState('Command+Shift+Space');
  const [holdShortcut, setHoldShortcut] = useState('');

  // Persist pushToTalk setting
  useEffect(() => {
    localStorage.setItem('pushToTalk', JSON.stringify(pushToTalk));
  }, [pushToTalk]);

  // Shortcut Recorder State
  const [recordingTarget, setRecordingTarget] = useState<'toggle' | 'hold' | null>(null);
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [shortcutWarning, setShortcutWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStopRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check API key status on startup
    window.electronAPI.getApiKeyStatus().then((apiStatus) => {
      if (!apiStatus.valid) {
        dispatch({ type: 'ERROR', status: 'Ready', errorMessage: apiStatus.error || 'API key error' });
        // Auto-open settings if no API key
        setActiveTab('settings');
      }
    });

    // Load API key
    window.electronAPI.getApiKey().then((key) => {
      setApiKey(key);
    });

    // Load Deepgram API key
    window.electronAPI.getDeepgramApiKey().then((key) => {
      setDeepgramApiKey(key);
    });

    // Load recent transcriptions from database
    window.electronAPI.dbGetTranscriptions({ limit: 20 }).then((result) => {
      if (result.success) {
        setRecentTranscriptions(result.transcriptions);
      }
    }).catch((error) => {
      console.error('Error loading transcriptions:', error);
    });

    // Load initial shortcuts
    window.electronAPI.getShortcuts().then((shortcuts) => {
      setToggleShortcut(shortcuts.toggle);
      setHoldShortcut(shortcuts.hold);
    });

    // Listen for global shortcut events from main process
    const unsubToggle = window.electronAPI.onToggleRecording(() => {
      const { phase } = stateRef.current;
      if (phase === 'processing') return;

      if (phase === 'recording' || phase === 'paused') {
        stopRecording();
      } else if (phase === 'ready') {
        startRecording();
      }
    });

    const unsubStart = window.electronAPI.onStartRecording(() => {
      const { phase } = stateRef.current;
      if (phase !== 'ready') return;
      startRecording();
    });

    const unsubStop = window.electronAPI.onStopRecording(() => {
      const { phase } = stateRef.current;
      if (phase === 'processing') return;
      if (phase === 'starting') {
        pendingStopRef.current = true;
        return;
      }
      if (phase !== 'recording' && phase !== 'paused') return;
      stopRecording();
    });

    const unsubPause = window.electronAPI.onPauseRecording(() => {
      if (stateRef.current.phase !== 'recording') return;
      pauseRecording();
    });

    const unsubResume = window.electronAPI.onResumeRecording(() => {
      if (stateRef.current.phase !== 'paused') return;
      resumeRecording();
    });

    // Live transcript updates from Deepgram
    const unsubTranscript = window.electronAPI.onDeepgramTranscript(({ text, isFinal }) => {
      if (isFinal) {
        finalsTextRef.current += (finalsTextRef.current ? ' ' : '') + text;
        setLiveTranscript(finalsTextRef.current);
      } else {
        // Show confirmed finals + current interim
        setLiveTranscript(finalsTextRef.current + (finalsTextRef.current ? ' ' : '') + text);
      }
    });

    // Ensure overlay is hidden on start
    window.electronAPI.setOverlayVisible(false);

    // Cleanup listeners on unmount
    return () => {
      unsubToggle();
      unsubStart();
      unsubStop();
      unsubPause();
      unsubResume();
      unsubTranscript();
    };
  }, []);

  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore if this is just a modifier key press
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
        const keys: string[] = [];
        if (e.metaKey) keys.push('Command');
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        setPressedKeys(keys);
        return;
      }

      // Build the shortcut string
      const keys: string[] = [];
      if (e.metaKey) keys.push('Command');
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');

      const triggerKey = getElectronAccelerator(e);
      if (triggerKey && !keys.includes(triggerKey)) {
        keys.push(triggerKey);
      }

      setPressedKeys(keys);

      // If we have a trigger key (non-modifier), save it
      if (triggerKey) {
        const shortcutString = keys.join('+');
        console.log(`[DEBUG] Shortcut recorded: "${shortcutString}" (target: ${recordingTarget}, keys:`, keys, ', triggerKey:', triggerKey, ')');

        // Check if this is a single letter/number key without modifiers (warn about common keys)
        const hasModifiers = e.metaKey || e.ctrlKey || e.altKey || (e.shiftKey && triggerKey.length > 1);
        const isCommonKey = /^[A-Z]$/.test(triggerKey) || triggerKey === 'Space';

        if (!hasModifiers && isCommonKey) {
          setShortcutWarning(`Using "${triggerKey}" alone will capture it globally. This may interfere with typing in other apps.`);
        } else {
          setShortcutWarning(null);
        }

        if (recordingTarget === 'toggle') {
          setToggleShortcut(shortcutString);
          window.electronAPI.setToggleShortcut(shortcutString);
        } else {
          setHoldShortcut(shortcutString);
          window.electronAPI.setHoldShortcut(shortcutString);
        }

        setRecordingTarget(null);
        setPressedKeys([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Optional cleanup
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recordingTarget]);






  const startRecording = async () => {
    try {
      dispatch({ type: 'START_REQUESTED' });
      pendingStopRef.current = false;
      finalsTextRef.current = '';
      setLiveTranscript('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Start Deepgram streaming session before recording
      const dgResult = await window.electronAPI.deepgramStartSession();
      if (!dgResult.success) {
        console.warn('Deepgram session failed:', (dgResult as any).error);
        // Fall through — will use Whisper fallback in stopRecording
      }

      // Set up audio analysis for overlay visualization
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const sendAudioData = () => {
        const { phase } = stateRef.current;
        if (phase !== 'recording' && phase !== 'paused') return;

        analyser.getByteTimeDomainData(dataArray);
        analyser.getByteFrequencyData(frequencyData);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const amplitude = (dataArray[i] - 128) / 128;
          sum += amplitude * amplitude;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const volume = Math.min(1, rms * 5);

        const barCount = 16;
        const waveform: number[] = [];
        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor(i * (frequencyData.length / 4) / barCount);
          waveform.push(frequencyData[freqIndex] / 255);
        }

        window.electronAPI.sendAudioData({ volume, waveform });
      };

      audioDataIntervalRef.current = setInterval(sendAudioData, 16);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        // Stream audio chunks to Deepgram via IPC
        if (event.data.size > 0) {
          event.data.arrayBuffer().then((buffer) => {
            window.electronAPI.deepgramSendAudioChunk(buffer);
          });
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      // 250ms timeslice for frequent streaming chunks
      mediaRecorder.start(250);
      dispatch({ type: 'RECORDING_STARTED' });
      window.electronAPI.setOverlayVisible(true);

      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        stopRecording();
      }
    } catch (error) {
      pendingStopRef.current = false;
      dispatch({ type: 'ERROR', status: 'Mic Error' });
      setTimeout(() => dispatch({ type: 'RESET' }), 3000);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Stop audio analysis
    if (audioDataIntervalRef.current) {
      clearInterval(audioDataIntervalRef.current);
      audioDataIntervalRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;

    // Stop MediaRecorder and tracks immediately
    mediaRecorder.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    dispatch({ type: 'STOP_PROCESSING' });
    setLiveTranscript('');
    finalsTextRef.current = '';
    window.electronAPI.setOverlayVisible(false);

    try {
      // Deepgram stop: finalizes transcript, formats with GPT, types text, saves to DB
      const result = await window.electronAPI.deepgramStopSession();

      if (result.success && result.formatted) {
        // Reload transcriptions from DB
        const reloadResult = await window.electronAPI.dbGetTranscriptions({ limit: 20 });
        if (reloadResult.success) {
          setRecentTranscriptions(reloadResult.transcriptions);
        }
        dispatch({ type: 'DONE', status: 'Done' });
      } else if (result.success) {
        // Empty transcript (silence)
        dispatch({ type: 'DONE', status: 'No speech detected' });
      } else {
        // Deepgram returned failure (e.g. no active session)
        dispatch({ type: 'ERROR', status: 'Error', errorMessage: (result as any).error || 'Transcription failed' });
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'An error occurred';
      let displayError: string;
      if (errorMsg.includes('API key') || errorMsg.includes('401')) {
        displayError = 'Invalid API key. Please check your API keys.';
      } else if (errorMsg.includes('insufficient_quota') || errorMsg.includes('429')) {
        displayError = 'API quota exceeded. Please check your billing.';
      } else if (errorMsg.includes('network') || errorMsg.includes('ENOTFOUND')) {
        displayError = 'Network error. Please check your internet connection.';
      } else {
        displayError = errorMsg;
      }
      dispatch({ type: 'ERROR', status: 'Error', errorMessage: displayError });
    } finally {
      setTimeout(() => dispatch({ type: 'RESET' }), 5000);
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.pause();
    dispatch({ type: 'PAUSE' });
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;

    mediaRecorderRef.current.resume();
    dispatch({ type: 'RESUME' });
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Stop audio analysis
    if (audioDataIntervalRef.current) {
      clearInterval(audioDataIntervalRef.current);
      audioDataIntervalRef.current = null;
    }

    mediaRecorderRef.current.stop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    audioChunksRef.current = [];

    dispatch({ type: 'CANCEL' });
    setLiveTranscript('');
    finalsTextRef.current = '';
    window.electronAPI.setOverlayVisible(false);

    setTimeout(() => dispatch({ type: 'RESET' }), 1500);
  };

  // Button Handlers
  const handleMouseDown = () => {
    if (isProcessing) return;
    if (pushToTalk) {
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (pushToTalk && isRecording) {
      stopRecording();
    }
  };

  const handleClick = () => {
    if (isProcessing) return;
    if (!pushToTalk) {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const handleSaveDeepgramKey = async () => {
    setDeepgramSaveStatus('saving');
    setDeepgramSaveMessage('');

    try {
      const result = await window.electronAPI.saveDeepgramApiKey(deepgramApiKey);

      if (result.success) {
        setDeepgramSaveStatus('success');
        setDeepgramSaveMessage('Deepgram API key saved!');
        setTimeout(() => {
          setDeepgramSaveStatus('idle');
          setDeepgramSaveMessage('');
        }, 3000);
      } else {
        setDeepgramSaveStatus('error');
        setDeepgramSaveMessage(result.error || 'Failed to save');
      }
    } catch (error: any) {
      setDeepgramSaveStatus('error');
      setDeepgramSaveMessage(error?.message || 'Failed to save');
    }
  };

  const handleSaveApiKey = async () => {
    setApiKeySaveStatus('saving');
    setApiKeySaveMessage('');

    try {
      const result = await window.electronAPI.saveApiKey(apiKey);

      if (result.success) {
        setApiKeySaveStatus('success');
        setApiKeySaveMessage('API key saved successfully!');
        clearError();

        // Clear success message after 3 seconds
        setTimeout(() => {
          setApiKeySaveStatus('idle');
          setApiKeySaveMessage('');
        }, 3000);
      } else {
        setApiKeySaveStatus('error');
        setApiKeySaveMessage(result.error || 'Failed to save API key');
      }
    } catch (error: any) {
      setApiKeySaveStatus('error');
      setApiKeySaveMessage(error?.message || 'Failed to save API key');
    }
  };

  // Determine recording status for header
  const getRecordingStatus = (): RecordingStatus => {
    if (isRecording) return 'recording';
    if (isProcessing) return 'processing';
    return 'ready';
  };

  const getStatusText = (): string => {
    return status;
  };

  const clearError = () => dispatch({ type: 'RESET' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Persistent Header */}
      <PersistentHeader
        status={getRecordingStatus()}
        statusText={getStatusText()}
        onCommandPaletteClick={() => {
          // TODO: Implement command palette in Phase 3
          console.log('Command palette not yet implemented');
        }}
        onSettingsClick={() => setActiveTab('settings')}
      />

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content Container */}
      <div className="tab-content-container">
        {/* Recording Tab */}
        <div className={`tab-content ${activeTab === 'recording' ? 'active' : ''}`}>
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', padding: '24px' }}>
            <div className="recording-section">
              <div className="record-button-container">
                <div className={`ripple ${isRecording ? 'active' : ''}`}></div>
                <div
                  className={`record-button ${isRecording ? 'recording' : ''}`}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={handleClick}
                  title={pushToTalk ? "Hold to Record" : "Click to Toggle"}
                >
                  <div className="mic-icon"></div>
                </div>
              </div>
              <div className={`status-badge ${isRecording || isProcessing ? 'active' : ''}`}>
                {status}
              </div>
              {isRecording && liveTranscript && (
                <div style={{
                  maxWidth: '90%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                  color: 'var(--text-secondary, #aaa)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  textAlign: 'center',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}>
                  {liveTranscript}
                </div>
              )}
              {isRecording && !pushToTalk && (
                <button className="cancel-btn" onClick={cancelRecording}>
                  Cancel
                </button>
              )}
              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                  <button className="error-dismiss" onClick={clearError}>×</button>
                </div>
              )}
            </div>

            <div className="recent-section">
              <div className="section-header">
                <span className="section-title">Recent History</span>
              </div>
              <div className="recent-list">
                {recentTranscriptions.length === 0 ? (
                  <div className="empty-state">
                    {pushToTalk ? "Hold button to speak" : "Click button to start"}
                  </div>
                ) : (
                  recentTranscriptions.map(item => (
                    <div key={item.id} className="recent-item">
                      <div className="recent-meta">
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {item.formatted_text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>

        {/* History Tab */}
        <div className={`tab-content ${activeTab === 'history' ? 'active' : ''}`}>
          <SearchView onClose={() => setActiveTab('recording')} />
        </div>

        {/* Settings Tab */}
        <div className={`tab-content ${activeTab === 'settings' ? 'active' : ''}`}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '24px', fontWeight: 600 }}>Settings</h2>

            <div className="setting-group">
              <label className="setting-label">OpenAI API Key</label>
              <div className="setting-description">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>platform.openai.com/api-keys</a>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="password"
                  className="setting-input"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={apiKeySaveStatus === 'saving'}
                  className="btn-primary"
                  style={{
                    width: 'auto',
                    minWidth: '100px',
                    backgroundColor: apiKeySaveStatus === 'success' ? 'var(--accent-success)' : 'var(--accent-primary)',
                    opacity: apiKeySaveStatus === 'saving' ? 0.6 : 1,
                    cursor: apiKeySaveStatus === 'saving' ? 'not-allowed' : 'pointer'
                  }}
                >
                  {apiKeySaveStatus === 'saving' ? 'Saving...' : apiKeySaveStatus === 'success' ? 'Saved!' : 'Save'}
                </button>
              </div>
              {apiKeySaveMessage && (
                <div className="error-message" style={{
                  backgroundColor: apiKeySaveStatus === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${apiKeySaveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'}`,
                  color: apiKeySaveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'
                }}>
                  {apiKeySaveMessage}
                </div>
              )}
            </div>

            <div className="setting-group">
              <label className="setting-label">Deepgram API Key</label>
              <div className="setting-description">
                Get your API key from <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>console.deepgram.com</a> — used for real-time streaming transcription
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="password"
                  className="setting-input"
                  placeholder="Enter Deepgram API key..."
                  value={deepgramApiKey}
                  onChange={(e) => setDeepgramApiKey(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
                <button
                  onClick={handleSaveDeepgramKey}
                  disabled={deepgramSaveStatus === 'saving'}
                  className="btn-primary"
                  style={{
                    width: 'auto',
                    minWidth: '100px',
                    backgroundColor: deepgramSaveStatus === 'success' ? 'var(--accent-success)' : 'var(--accent-primary)',
                    opacity: deepgramSaveStatus === 'saving' ? 0.6 : 1,
                    cursor: deepgramSaveStatus === 'saving' ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deepgramSaveStatus === 'saving' ? 'Saving...' : deepgramSaveStatus === 'success' ? 'Saved!' : 'Save'}
                </button>
              </div>
              {deepgramSaveMessage && (
                <div className="error-message" style={{
                  backgroundColor: deepgramSaveStatus === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${deepgramSaveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'}`,
                  color: deepgramSaveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'
                }}>
                  {deepgramSaveMessage}
                </div>
              )}
            </div>

            <div className="setting-group">
              <label className="setting-label">Toggle Recording Shortcut</label>
              <div className="setting-description" style={{ marginBottom: '8px' }}>
                Single keys like F9 or F10 are supported and recommended. Common keys (letters, Space) will also type in the focused app.
              </div>
              <div className="shortcut-recorder">
                <div
                  className={`shortcut-display ${recordingTarget === 'toggle' ? 'recording' : ''}`}
                  onClick={() => {
                    setRecordingTarget('toggle');
                    setPressedKeys([]);
                    setShortcutError(null);
                  }}
                >
                  {recordingTarget === 'toggle'
                    ? (pressedKeys.length > 0 ? pressedKeys.join('+') : 'Press keys...')
                    : (toggleShortcut || 'None')}
                </div>
                {recordingTarget === 'toggle' ? (
                  <button className="cancel-record-btn" onClick={(e) => {
                    e.stopPropagation();
                    setRecordingTarget(null);
                    setPressedKeys([]);
                  }}>Cancel</button>
                ) : (
                  <button className="reset-btn" onClick={() => {
                    setToggleShortcut('');
                    window.electronAPI.setToggleShortcut('');
                  }} title="Clear Shortcut">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Hold to Talk Shortcut</label>
              <div className="setting-description" style={{ marginBottom: '8px' }}>
                Press and hold key to record, release to stop and paste. You can use any key - try F13-F24, CapsLock, or less common letters. Single keys like K will work but may interfere with typing.
              </div>
              <div className="shortcut-recorder">
                <div
                  className={`shortcut-display ${recordingTarget === 'hold' ? 'recording' : ''}`}
                  onClick={() => {
                    setRecordingTarget('hold');
                    setPressedKeys([]);
                    setShortcutError(null);
                    setShortcutWarning(null);
                  }}
                >
                  {recordingTarget === 'hold'
                    ? (pressedKeys.length > 0 ? pressedKeys.join('+') : 'Press any key...')
                    : (holdShortcut || 'Click to set')}
                </div>
                {recordingTarget === 'hold' ? (
                  <button className="cancel-record-btn" onClick={(e) => {
                    e.stopPropagation();
                    setRecordingTarget(null);
                    setPressedKeys([]);
                    setShortcutWarning(null);
                  }}>Cancel</button>
                ) : (
                  <button className="reset-btn" onClick={() => {
                    setHoldShortcut('');
                    window.electronAPI.setHoldShortcut('');
                    setShortcutWarning(null);
                  }} title="Clear Shortcut">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
              {shortcutWarning && (
                <div className="error-message" style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--accent-warning)',
                  color: 'var(--accent-warning)'
                }}>
                  ⚠️ {shortcutWarning}
                </div>
              )}
            </div>

            <div className="setting-group">
              <div className="switch-row">
                <label className="switch-label" htmlFor="push-to-talk">
                  Push to Talk (Button Only)
                </label>
                <Switch.Root
                  className="switch-root"
                  id="push-to-talk"
                  checked={pushToTalk}
                  onCheckedChange={setPushToTalk}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
              <div className="setting-description">Hold the in-app button to record</div>
            </div>

            {/* Custom Dictionary */}
            <DictionarySettings />
          </div>
        </div>
      </div>

      {/* Contextual Footer */}
      <ContextualFooter
        activeTab={activeTab}
        recordingMode={isRecording ? 'recording' : (isProcessing ? 'processing' : 'ready')}
      />
    </div>
  );
}
