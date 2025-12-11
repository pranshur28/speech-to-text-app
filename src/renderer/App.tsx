import React, { useState, useRef, useEffect } from 'react';
import './styles.css';
import { SearchView } from './SearchView';
import TabBar, { TabType } from './components/TabBar';
import PersistentHeader, { RecordingStatus } from './components/PersistentHeader';
import ContextualFooter from './components/ContextualFooter';
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

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentTranscriptions, setRecentTranscriptions] = useState<Transcription[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaveStatus, setApiKeySaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [apiKeySaveMessage, setApiKeySaveMessage] = useState('');

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
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isPausedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    // Check API key status on startup
    window.electronAPI.getApiKeyStatus().then((status) => {
      if (!status.valid) {
        setErrorMessage(status.error || 'API key error');
        // Auto-open settings if no API key
        setActiveTab('settings');
      }
    });

    // Load API key
    window.electronAPI.getApiKey().then((key) => {
      setApiKey(key);
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
      if (isProcessingRef.current) return;

      if (isRecordingRef.current) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    const unsubStart = window.electronAPI.onStartRecording(() => {
      if (isProcessingRef.current || isRecordingRef.current) return;
      startRecording();
    });

    const unsubStop = window.electronAPI.onStopRecording(() => {
      if (isProcessingRef.current || !isRecordingRef.current) return;
      stopRecording();
    });

    const unsubPause = window.electronAPI.onPauseRecording(() => {
      if (!isRecordingRef.current || isPausedRef.current) return;
      pauseRecording();
    });

    const unsubResume = window.electronAPI.onResumeRecording(() => {
      if (!isRecordingRef.current || !isPausedRef.current) return;
      resumeRecording();
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

        if (!hasModifiers && isCommonKey && recordingTarget === 'hold') {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Set up audio analysis for overlay visualization
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Increased for better resolution
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Start sending volume data to overlay using setInterval (works even when app is not focused)
      const dataArray = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const sendAudioData = () => {
        if (!isRecordingRef.current) return;

        analyser.getByteTimeDomainData(dataArray);
        analyser.getByteFrequencyData(frequencyData);

        // Calculate RMS (Root Mean Square) for volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const amplitude = (dataArray[i] - 128) / 128;
          sum += amplitude * amplitude;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Normalize to 0-1 range (approximate) and send
        // Boost low volumes slightly
        const volume = Math.min(1, rms * 5);

        // Sample frequency data for waveform bars (take 16 bars from low-mid frequencies)
        const barCount = 16;
        const waveform: number[] = [];
        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor(i * (frequencyData.length / 4) / barCount);
          waveform.push(frequencyData[freqIndex] / 255);
        }

        console.log('[APP] Sending audio data:', { volume, waveform: waveform.slice(0, 3) });
        window.electronAPI.sendAudioData({ volume, waveform });
      };

      // Use setInterval instead of requestAnimationFrame to ensure it works even when app is not focused
      // ~60fps (16ms) for smoother animation
      audioDataIntervalRef.current = setInterval(sendAudioData, 16);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus('Listening...');
      window.electronAPI.setOverlayVisible(true);
    } catch (error) {
      setStatus('Mic Error');
      setTimeout(() => setStatus('Ready'), 3000);
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

    mediaRecorder.onstop = async () => {
      // Stop all tracks immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
      setIsPaused(false);
      setIsProcessing(true);
      setStatus('Thinking...');
      window.electronAPI.setOverlayVisible(false);

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const buffer = await audioBlob.arrayBuffer();

      try {
        const transcribeResult = await window.electronAPI.transcribeAudio(buffer);

        if (transcribeResult.success) {
          setStatus('Formatting...');
          const formatResult = await window.electronAPI.formatText(transcribeResult.transcript);

          if (formatResult.success) {
            // Save to database
            const dbResult = await window.electronAPI.dbSaveTranscription({
              raw_text: transcribeResult.transcript,
              formatted_text: formatResult.formatted,
              timestamp: Date.now(),
              formatting_profile: 'casual',
              is_favorite: 0
            });

            if (dbResult.success) {
              // Reload transcriptions from database
              const reloadResult = await window.electronAPI.dbGetTranscriptions({ limit: 20 });
              if (reloadResult.success) {
                setRecentTranscriptions(reloadResult.transcriptions);
              }
            }

            setStatus('Pasting...');
            await window.electronAPI.pasteText(formatResult.formatted);
            setStatus('Done');
          }
        }
      } catch (error: any) {
        setStatus('Error');
        const errorMsg = error?.message || 'An error occurred';
        if (errorMsg.includes('API key') || errorMsg.includes('401')) {
          setErrorMessage('Invalid API key. Please check your OpenAI API key.');
        } else if (errorMsg.includes('insufficient_quota') || errorMsg.includes('429')) {
          setErrorMessage('API quota exceeded. Please check your OpenAI billing.');
        } else if (errorMsg.includes('network') || errorMsg.includes('ENOTFOUND')) {
          setErrorMessage('Network error. Please check your internet connection.');
        } else {
          setErrorMessage(errorMsg);
        }
      } finally {
        setIsProcessing(false);
        setTimeout(() => {
          setStatus('Ready');
          setErrorMessage(null);
        }, 5000);
      }
    };

    mediaRecorder.stop();
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.pause();
    setIsPaused(true);
    setStatus('Paused');
  };

  const resumeRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'paused') return;

    mediaRecorderRef.current.resume();
    setIsPaused(false);
    setStatus('Listening...');
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Stop audio analysis
    if (audioDataIntervalRef.current) {
      clearInterval(audioDataIntervalRef.current);
      audioDataIntervalRef.current = null;
    }

    // Stop and discard recording
    mediaRecorderRef.current.stop();

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear chunks so nothing gets processed
    audioChunksRef.current = [];

    setIsRecording(false);
    setIsPaused(false);
    setStatus('Cancelled');
    window.electronAPI.setOverlayVisible(false);

    setTimeout(() => setStatus('Ready'), 1500);
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

  const handleSaveApiKey = async () => {
    setApiKeySaveStatus('saving');
    setApiKeySaveMessage('');

    try {
      const result = await window.electronAPI.saveApiKey(apiKey);

      if (result.success) {
        setApiKeySaveStatus('success');
        setApiKeySaveMessage('API key saved successfully!');
        setErrorMessage(null);

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
    if (isRecording) return status;
    if (isProcessing) return status;
    return 'Ready';
  };

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
              {isRecording && !pushToTalk && (
                <button className="cancel-btn" onClick={cancelRecording}>
                  Cancel
                </button>
              )}
              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                  <button className="error-dismiss" onClick={() => setErrorMessage(null)}>×</button>
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
              <label className="setting-label">Toggle Recording Shortcut</label>
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
