import React from 'react';

export type RecordingStatus = 'ready' | 'recording' | 'processing';

interface PersistentHeaderProps {
  status: RecordingStatus;
  statusText?: string;
  onCommandPaletteClick?: () => void;
  onSettingsClick?: () => void;
}

export default function PersistentHeader({
  status,
  statusText,
  onCommandPaletteClick,
  onSettingsClick
}: PersistentHeaderProps) {
  const getStatusText = () => {
    if (statusText) return statusText;

    switch (status) {
      case 'ready':
        return 'Ready';
      case 'recording':
        return 'Recording';
      case 'processing':
        return 'Processing';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="persistent-header">
      <div className="persistent-header-left">
        <h1 className="persistent-header-title">🎙️ Speech to Text</h1>
        <div className={`persistent-header-status ${status}`}>
          <span className="status-dot"></span>
          <span>{getStatusText()}</span>
        </div>
      </div>

      <div className="persistent-header-right">
        {onCommandPaletteClick && (
          <button
            className="header-icon-btn"
            onClick={onCommandPaletteClick}
            aria-label="Open command palette (⌘K)"
            title="Command Palette (⌘K)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        )}
        {onSettingsClick && (
          <button
            className="header-icon-btn"
            onClick={onSettingsClick}
            aria-label="Settings"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6"></path>
              <path d="m1 12 6 0m6 0 6 0"></path>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
