import React, { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { RecordingPhase } from '../recordingState';
import type { SttEngine } from '../../preload';

export type TabType = 'recording' | 'history' | 'settings';

const TABS: { id: TabType; label: string }[] = [
  { id: 'recording', label: 'Record' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

const ENGINE_LABELS: Record<SttEngine, string> = { 'flux': 'Flux', 'nova-3': 'Nova-3' };

function statusTone(phase: RecordingPhase, hasError: boolean): string {
  if (phase === 'recording' || phase === 'starting') return 'recording';
  if (phase === 'paused') return 'paused';
  if (phase === 'processing') return 'processing';
  return hasError ? 'error' : 'ready';
}

interface TopBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  phase: RecordingPhase;
  statusText: string;
  hasError: boolean;
  engine: SttEngine;
}

/** The window's title bar: status on the left, section switcher centred, Windows' own buttons on the right. */
export default function TopBar({ activeTab, onTabChange, phase, statusText, hasError, engine }: TopBarProps) {
  // Ctrl+1/2/3 switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const index = ['1', '2', '3'].indexOf(e.key);
      if (index === -1) return;
      e.preventDefault();
      onTabChange(TABS[index].id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  return (
    <header className="top-bar">
      <div className={`status-pill status-pill--${statusTone(phase, hasError)}`} role="status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{statusText}</span>
        <span className="status-engine">{ENGINE_LABELS[engine]}</span>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(value) => onTabChange(value as TabType)}>
        <Tabs.List className="segmented" aria-label="Sections">
          {TABS.map((tab, index) => (
            <Tabs.Trigger key={tab.id} value={tab.id} className="segmented-item" title={`${tab.label} (Ctrl+${index + 1})`}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      {/* Keeps the switcher centred; Windows' caption buttons are drawn over this area */}
      <div className="titlebar-spacer" aria-hidden="true" />
    </header>
  );
}
