import React from 'react';

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
  isProcessing: boolean;
  status: string;
  errorMessage: string | null;
  liveTranscript: string;
  pushToTalk: boolean;
  recentTranscriptions: Transcription[];
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onDismissError: () => void;
}

export const RecordingTab: React.FC<RecordingTabProps> = ({
  isRecording,
  isProcessing,
  status,
  errorMessage,
  liveTranscript,
  pushToTalk,
  recentTranscriptions,
  onStart,
  onStop,
  onCancel,
  onDismissError,
}) => {
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

  return (
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
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        {errorMessage && (
          <div className="error-message">
            {errorMessage}
            <button className="error-dismiss" onClick={onDismissError}>×</button>
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
  );
};
