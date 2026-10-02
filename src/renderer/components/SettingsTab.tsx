import React, { useCallback, useEffect, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { DictionarySettings } from './DictionarySettings';
import { ShortcutRecorder } from './ShortcutRecorder';
import type { SttEngine } from '../../preload';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface SettingsTabProps {
  pushToTalk: boolean;
  onPushToTalkChange: (value: boolean) => void;
  /** Called after a Deepgram key was saved, so a "missing key" error can be cleared. */
  onDeepgramKeySaved: () => void;
}

const ENGINE_DESCRIPTIONS: Record<SttEngine, string> = {
  'flux': 'Detects when you finish a thought, so text is pasted in whole sentences.',
  'nova-3': 'Pastes after short pauses. Formats numbers and dates, and turns spoken "comma", "period", "new line" or "new paragraph" into punctuation.',
};

export const SettingsTab: React.FC<SettingsTabProps> = ({ pushToTalk, onPushToTalkChange, onDeepgramKeySaved }) => {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [engine, setEngine] = useState<SttEngine>('flux');
  const [toggleShortcut, setToggleShortcut] = useState('');
  const [holdShortcut, setHoldShortcut] = useState('');
  const [listeningTarget, setListeningTarget] = useState<'toggle' | 'hold' | null>(null);

  useEffect(() => {
    window.electronAPI.getDeepgramApiKey().then(setDeepgramApiKey);
    window.electronAPI.getSttEngine().then(setEngine);
    window.electronAPI.getShortcuts().then((shortcuts) => {
      setToggleShortcut(shortcuts.toggle);
      setHoldShortcut(shortcuts.hold);
    });
  }, []);

  const handleSaveDeepgramKey = async () => {
    setSaveStatus('saving');
    setSaveMessage('');

    try {
      const result = await window.electronAPI.saveDeepgramApiKey(deepgramApiKey);
      if (result.success) {
        setSaveStatus('success');
        setSaveMessage('Deepgram API key saved!');
        onDeepgramKeySaved();
        setTimeout(() => {
          setSaveStatus('idle');
          setSaveMessage('');
        }, 3000);
      } else {
        setSaveStatus('error');
        setSaveMessage(result.error || 'Failed to save');
      }
    } catch (error: any) {
      setSaveStatus('error');
      setSaveMessage(error?.message || 'Failed to save');
    }
  };

  const handleEngineChange = (value: SttEngine) => {
    setEngine(value);
    window.electronAPI.setSttEngine(value);
  };

  const handleToggleShortcutChange = useCallback((shortcut: string) => {
    setToggleShortcut(shortcut);
    window.electronAPI.setToggleShortcut(shortcut);
  }, []);

  const handleHoldShortcutChange = useCallback((shortcut: string) => {
    setHoldShortcut(shortcut);
    window.electronAPI.setHoldShortcut(shortcut);
  }, []);

  const listenForToggle = useCallback((listening: boolean) => setListeningTarget(listening ? 'toggle' : null), []);
  const listenForHold = useCallback((listening: boolean) => setListeningTarget(listening ? 'hold' : null), []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
      <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '24px', fontWeight: 600 }}>Settings</h2>

      <div className="setting-group">
        <label className="setting-label">Deepgram API Key</label>
        <div className="setting-description">
          Get your API key from <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>console.deepgram.com</a> — used for real-time streaming transcription
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="password"
            className="setting-input"
            placeholder="Enter Deepgram API key..."
            value={deepgramApiKey}
            onChange={(e) => setDeepgramApiKey(e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <button
            onClick={handleSaveDeepgramKey}
            disabled={saveStatus === 'saving'}
            className="btn-primary"
            style={{
              width: 'auto',
              minWidth: '100px',
              backgroundColor: saveStatus === 'success' ? 'var(--accent-success)' : 'var(--accent-primary)',
              opacity: saveStatus === 'saving' ? 0.6 : 1,
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
            }}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save'}
          </button>
        </div>
        {saveMessage && (
          <div className="error-message" style={{
            backgroundColor: saveStatus === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${saveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'}`,
            color: saveStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-success)'
          }}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="setting-group">
        <label className="setting-label" htmlFor="stt-engine">Transcription Model</label>
        <select
          id="stt-engine"
          className="setting-input"
          value={engine}
          onChange={(e) => handleEngineChange(e.target.value as SttEngine)}
          style={{ marginTop: '8px' }}
        >
          <option value="flux">Flux (default)</option>
          <option value="nova-3">Nova-3</option>
        </select>
        <div className="setting-description" style={{ marginTop: '8px' }}>
          {ENGINE_DESCRIPTIONS[engine]} Applies from the next recording.
        </div>
      </div>

      <ShortcutRecorder
        label="Toggle Recording Shortcut"
        description="Single keys like F9 or F10 are supported and recommended. Common keys (letters, Space) will also type in the focused app."
        value={toggleShortcut}
        emptyText="None"
        listeningText="Press keys..."
        isListening={listeningTarget === 'toggle'}
        onListeningChange={listenForToggle}
        onChange={handleToggleShortcutChange}
      />

      <ShortcutRecorder
        label="Hold to Talk Shortcut"
        description="Press and hold key to record, release to stop and paste. You can use any key - try F13-F24, CapsLock, or less common letters. Single keys like K will work but may interfere with typing."
        value={holdShortcut}
        emptyText="Click to set"
        listeningText="Press any key..."
        isListening={listeningTarget === 'hold'}
        onListeningChange={listenForHold}
        onChange={handleHoldShortcutChange}
      />

      <div className="setting-group">
        <div className="switch-row">
          <label className="switch-label" htmlFor="push-to-talk">
            Push to Talk (Button Only)
          </label>
          <Switch.Root
            className="switch-root"
            id="push-to-talk"
            checked={pushToTalk}
            onCheckedChange={onPushToTalkChange}
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
        <div className="setting-description">Hold the in-app button to record</div>
      </div>

      <DictionarySettings />
    </div>
  );
};
