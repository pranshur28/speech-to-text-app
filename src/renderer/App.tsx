import React, { useState, useRef, useEffect } from 'react';
import './styles.css';

interface Transcription {
  id: string;
  text: string;
  timestamp: number;
}

export default function App() {
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
  const [status, setStatus] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentTranscriptions, setRecentTranscriptions] = useState<Transcription[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    // Check API key status on startup
    window.electronAPI.getApiKeyStatus().then((status) => {
      if (!status.valid) {
        setErrorMessage(status.error || 'API key error');
      }
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

    // Ensure overlay is hidden on start
    window.electronAPI.setOverlayVisible(false);

    // Cleanup listeners on unmount
    return () => {
      unsubToggle();
      unsubStart();
      unsubStop();
    };
  }, []);

  useEffect(() => {
    if (!recordingTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

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

      // Start sending volume data to overlay
      const dataArray = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      let lastSendTime = 0;
      const sendAudioData = (timestamp: number) => {
        if (!isRecordingRef.current) return;

        // Throttle to ~60fps (16ms) for smoother animation
        if (timestamp - lastSendTime >= 16) {
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

          window.electronAPI.sendAudioData({ volume, waveform });
          lastSendTime = timestamp;
        }

        animationFrameRef.current = requestAnimationFrame(sendAudioData);
      };
      requestAnimationFrame(sendAudioData);

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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;

    mediaRecorder.onstop = async () => {
      // Stop all tracks immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
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
            const newTranscription: Transcription = {
              id: Date.now().toString(),
              text: formatResult.formatted,
              timestamp: Date.now()
            };
            setRecentTranscriptions(prev => [newTranscription, ...prev].slice(0, 20));

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

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    // Stop audio analysis
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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

  return (
    <div className="app-container">
      <header>
        <div className="header-content">
          <h1>Speech to Text</h1>
          <div className="subtitle">AI Assistant</div>
        </div>
        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </header>

      <main>
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
                  {item.text}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <div className={`modal-overlay ${isSettingsOpen ? 'open' : ''}`} onClick={(e) => {
        if (e.target === e.currentTarget) setIsSettingsOpen(false);
      }}>
        <div className="modal">
          <div className="modal-header">
            <div className="modal-title">Settings</div>
            <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>×</button>
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
            <div className="shortcut-recorder">
              <div
                className={`shortcut-display ${recordingTarget === 'hold' ? 'recording' : ''}`}
                onClick={() => {
                  setRecordingTarget('hold');
                  setPressedKeys([]);
                  setShortcutError(null);
                }}
              >
                {recordingTarget === 'hold'
                  ? (pressedKeys.length > 0 ? pressedKeys.join('+') : 'Press keys...')
                  : (holdShortcut || 'None')}
              </div>
              {recordingTarget === 'hold' ? (
                <button className="cancel-record-btn" onClick={(e) => {
                  e.stopPropagation();
                  setRecordingTarget(null);
                  setPressedKeys([]);
                }}>Cancel</button>
              ) : (
                <button className="reset-btn" onClick={() => {
                  setHoldShortcut('');
                  window.electronAPI.setHoldShortcut('');
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
            <div className={`toggle-switch ${pushToTalk ? 'active' : ''}`} onClick={() => setPushToTalk(!pushToTalk)}>
              <span className="setting-label" style={{ marginBottom: 0 }}>Push to Talk (Button Only)</span>
              <div className="toggle-track">
                <div className="toggle-thumb"></div>
              </div>
            </div>
            <div className="setting-description">Hold the in-app button to record</div>
          </div>
        </div>
      </div>
    </div>
  );
}
