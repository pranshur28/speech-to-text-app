import React from 'react';
import { TabType } from './TabBar';

interface Shortcut {
  key: string;
  label: string;
}

interface ContextualFooterProps {
  activeTab: TabType;
  recordingMode?: 'ready' | 'recording' | 'processing';
}

const tabShortcuts: Record<TabType, Shortcut[]> = {
  recording: [
    { key: '⌘⇧Space', label: 'Record' },
    { key: '⌘K', label: 'Command Palette' },
    { key: '⌘H', label: 'History' }
  ],
  history: [
    { key: '↑↓', label: 'Navigate' },
    { key: '⏎', label: 'Open' },
    { key: '⌘A', label: 'Select All' },
    { key: '⌘E', label: 'Export' }
  ],
  settings: [
    { key: '⌘K', label: 'Command Palette' },
    { key: '⌘1', label: 'Recording' },
    { key: '⌘2', label: 'History' }
  ]
};

const recordingStateShortcuts: Shortcut[] = [
  { key: 'Space', label: 'Pause' },
  { key: 'Esc', label: 'Cancel' }
];

const processingStateShortcuts: Shortcut[] = [
  { key: 'Please wait', label: '' }
];

export default function ContextualFooter({ activeTab, recordingMode }: ContextualFooterProps) {
  let shortcuts: Shortcut[] = [];

  // If recording or processing, show state-specific shortcuts
  if (recordingMode === 'recording') {
    shortcuts = recordingStateShortcuts;
  } else if (recordingMode === 'processing') {
    shortcuts = processingStateShortcuts;
  } else {
    // Otherwise, show tab-specific shortcuts
    shortcuts = tabShortcuts[activeTab] || [];
  }

  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="contextual-footer">
      {shortcuts.map((shortcut, index) => (
        <React.Fragment key={`${shortcut.key}-${index}`}>
          {index > 0 && <span className="footer-separator">•</span>}
          <div className="footer-shortcut">
            <kbd>{shortcut.key}</kbd>
            {shortcut.label && <span>: {shortcut.label}</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
