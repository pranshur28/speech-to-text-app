import React, { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { RecordingPhase } from '../recordingState';
import type { SttEngine } from '../../preload';

export type TabType = 'recording' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: JSX.Element }[] = [
  {
    id: 'recording',
    label: 'Record',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
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
        <Tabs.List className="tab-list" aria-label="Sections">
          {TABS.map((tab) => (
            <Tabs.Trigger key={tab.id} value={tab.id} className="tab-trigger" aria-label={tab.label} title={`${tab.label} (Ctrl+${TABS.indexOf(tab) + 1})`}>
              {tab.icon}
              <span>{tab.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </header>
  );
}
