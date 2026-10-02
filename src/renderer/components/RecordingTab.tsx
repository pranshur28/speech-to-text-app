import React, { useEffect, useRef, useState } from 'react';
import { formatElapsed, shortcutKeys } from '../format';

export interface Transcription {
  id: number;
  raw_text: string;
  formatted_text: string;
  timestamp: number;
  formatting_profile: string;
  is_favorite: number;
  created_at: number;
}

interface RecordingTabProps {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  errorMessage: string | null;
  pushToTalk: boolean;
  toggleShortcut: string;
  holdShortcut: string;
  recentTranscriptions: Transcription[];
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onDismissError: () => void;
}

// Recording time, excluding time spent paused
function useElapsed(active: boolean, paused: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    setElapsed(0);
    lastTickRef.current = Date.now();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    lastTickRef.current = Date.now();
    if (paused) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed((value) => value + (now - lastTickRef.current));
      lastTickRef.current = now;
    }, 250);
    return () => clearInterval(interval);
  }, [active, paused]);

  return elapsed;
}

const KeyChips: React.FC<{ shortcut: string }> = ({ shortcut }) => (
  <span className="kbd-group">
    {shortcutKeys(shortcut).map((key) => <kbd key={key}>{key}</kbd>)}
  </span>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 5.5v-.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const RecentItem: React.FC<{ item: Transcription }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.formatted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <li className={`recent-row ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="recent-row-body"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        title={expanded ? 'Show less' : 'Show all'}
      >
        <span className="recent-row-text">{item.formatted_text}</span>
        <time className="recent-row-time">
          {new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </time>
      </button>
      <button
        type="button"
        className={`round-btn ${copied ? 'is-done' : ''}`}
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy transcription'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </li>
  );
};

export const RecordingTab: React.FC<RecordingTabProps> = ({
  isRecording,
  isPaused,
  isProcessing,
  errorMessage,
  pushToTalk,
  toggleShortcut,
  holdShortcut,
  recentTranscriptions,
  onStart,
  onStop,
  onCancel,
  onDismissError,
}) => {
  const elapsed = useElapsed(isRecording, isPaused);

  const handleMouseDown = () => {
    if (isProcessing) return;
    if (pushToTalk) onStart();
  };

  const handleMouseUp = () => {
    if (pushToTalk && isRecording) onStop();
  };

  const handleClick = () => {
    if (isProcessing || pushToTalk) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  const buttonLabel = pushToTalk
    ? 'Hold to record'
    : isRecording ? 'Stop recording' : 'Start recording';

  const live = isRecording && !isPaused;

  return (
    <div className="recording-tab">
      <section className="recorder" aria-label="Recorder">
        <div className={`orb-wrap ${isRecording ? 'is-recording' : ''} ${live ? 'is-live' : ''}`}>
          <span className="orb-halo" aria-hidden="true" />
          <span className="orb-ring orb-ring--outer" aria-hidden="true" />
          <span className="orb-ring orb-ring--inner" aria-hidden="true" />
          <button
            type="button"
            className={`orb ${isRecording ? 'orb--recording' : ''} ${isProcessing ? 'orb--busy' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
            disabled={isProcessing}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            {isRecording && !pushToTalk ? (
              <span className="stop-glyph" aria-hidden="true" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="2.5" width="6" height="12" rx="3" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                <line x1="12" y1="17.5" x2="12" y2="21" />
              </svg>
            )}
          </button>
        </div>

        {isRecording ? (
          <div className={`recorder-timer ${isPaused ? 'is-paused' : ''}`}>{formatElapsed(elapsed)}</div>
        ) : (
          <h1 className="recorder-title">{isProcessing ? 'Finishing up…' : 'Ready when you are'}</h1>
        )}

        <p className="recorder-hint">
          {isRecording ? (
            isPaused ? (
              <span>Paused</span>
            ) : toggleShortcut && !pushToTalk ? (
              <>Listening — press <KeyChips shortcut={toggleShortcut} /> to stop</>
            ) : (
              <span>Listening…</span>
            )
          ) : toggleShortcut ? (
            <>Press <KeyChips shortcut={toggleShortcut} /> anywhere to dictate</>
          ) : holdShortcut ? (
            <>Hold <KeyChips shortcut={holdShortcut} /> anywhere to dictate</>
          ) : (
            <span>{pushToTalk ? 'Hold the button to dictate' : 'Click the button to dictate'}</span>
          )}
        </p>

        {isRecording && !pushToTalk && (
          <button type="button" className="capsule-btn" onClick={onCancel}>
            Cancel
          </button>
        )}

        {errorMessage && (
          <div className="alert alert--error" role="alert">
            <span>{errorMessage}</span>
            <button type="button" className="alert-dismiss" onClick={onDismissError} aria-label="Dismiss">×</button>
          </div>
        )}
      </section>

      <section className={`recent ${isRecording ? 'is-dimmed' : ''}`} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="title-3">Recent</h2>
        {recentTranscriptions.length === 0 ? (
          <p className="empty-hint">Your dictations will appear here.</p>
        ) : (
          <ul className="grouped recent-list">
            {recentTranscriptions.map((item) => <RecentItem key={item.id} item={item} />)}
          </ul>
        )}
      </section>
    </div>
  );
};
