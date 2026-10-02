import React from 'react';
import type { TabType } from './TopBar';
import { shortcutKeys } from '../format';

interface Hint {
  keys: string[];
  label: string;
}

interface ContextualFooterProps {
  activeTab: TabType;
  isRecording: boolean;
  toggleShortcut: string;
  holdShortcut: string;
}

// Only shortcuts that actually work, using the user's configured keys
function buildHints({ activeTab, isRecording, toggleShortcut, holdShortcut }: ContextualFooterProps): Hint[] {
  const hints: Hint[] = [];

  if (isRecording) {
    if (toggleShortcut) hints.push({ keys: shortcutKeys(toggleShortcut), label: 'Stop' });
    if (holdShortcut) hints.push({ keys: shortcutKeys(holdShortcut), label: 'Release to stop' });
    return hints;
  }

  if (activeTab === 'recording') {
    if (toggleShortcut) hints.push({ keys: shortcutKeys(toggleShortcut), label: 'Start / stop' });
    if (holdShortcut) hints.push({ keys: shortcutKeys(holdShortcut), label: 'Hold to talk' });
  }
  if (activeTab === 'history') {
    hints.push({ keys: ['Ctrl', 'F'], label: 'Search' });
  }
  hints.push({ keys: ['Ctrl', '1–3'], label: 'Switch tabs' });
  return hints;
}

export default function ContextualFooter(props: ContextualFooterProps) {
  const hints = buildHints(props);
  if (hints.length === 0) return null;

  return (
    <footer className="footer">
      {hints.map((hint) => (
        <span key={hint.label} className="footer-hint">
          <span className="kbd-group">
            {hint.keys.map((key) => <kbd key={key}>{key}</kbd>)}
          </span>
          <span>{hint.label}</span>
        </span>
      ))}
    </footer>
  );
}
