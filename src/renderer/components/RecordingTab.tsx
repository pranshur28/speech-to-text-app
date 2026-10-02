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

const RecentItem: React.FC<{ item: Transcription }> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.formatted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <li className={`recent-item ${expanded ? 'recent-item--expanded' : ''}`}>
      <div className="recent-item-header">
        <time className="recent-item-time">{new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
        <button
          type="button"
          className={`icon-text-btn ${copied ? 'icon-text-btn--success' : ''}`}
          onClick={handleCopy}
          aria-label="Copy transcription"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button
        type="button"
        className="recent-item-text"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        title={expanded ? 'Show less' : 'Show all'}
      >
        {item.formatted_text}
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

  return (
    <div className="recording-tab">
      <section className="recorder" aria-label="Recorder">
        <div className={`record-button-wrap ${isRecording && !isPaused ? 'is-live' : ''}`}>
          <span className="record-ring" aria-hidden="true" />
          <button
            type="button"
            className={`record-button ${isRecording ? 'record-button--recording' : ''} ${isProcessing ? 'record-button--busy' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
            disabled={isProcessing}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            {isRecording && !pushToTalk ? (
              <span className="stop-icon" aria-hidden="true" />
            ) : (
              <span className="mic-icon" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="recorder-caption">
          {isRecording ? (
            <span className="recorder-timer">{isPaused ? 'Paused · ' : ''}{formatElapsed(elapsed)}</span>
          ) : isProcessing ? (
            <span className="recorder-hint">Finishing up…</span>
          ) : toggleShortcut ? (
            <span className="recorder-hint">Press <KeyChips shortcut={toggleShortcut} /> anywhere to dictate</span>
          ) : holdShortcut ? (
            <span className="recorder-hint">Hold <KeyChips shortcut={holdShortcut} /> anywhere to dictate</span>
          ) : (
            <span className="recorder-hint">{pushToTalk ? 'Hold the button to dictate' : 'Click the button to dictate'}</span>
          )}
        </div>

        {isRecording && !pushToTalk && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
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

      <section className="recent" aria-label="Recent transcriptions">
        <h2 className="section-heading">Recent</h2>
        {recentTranscriptions.length === 0 ? (
          <p className="empty-hint">Your dictations will appear here.</p>
        ) : (
          <ul className="recent-list">
            {recentTranscriptions.map((item) => <RecentItem key={item.id} item={item} />)}
          </ul>
        )}
      </section>
    </div>
  );
};
