import React, { useCallback, useEffect, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { DictionarySettings } from './DictionarySettings';
import { ShortcutRecorder } from './ShortcutRecorder';
import type { SttEngine } from '../../preload';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface SettingsTabProps {
  engine: SttEngine;
  onEngineChange: (engine: SttEngine) => void;
  toggleShortcut: string;
  holdShortcut: string;
  onToggleShortcutChange: (shortcut: string) => void;
  onHoldShortcutChange: (shortcut: string) => void;
  pushToTalk: boolean;
  onPushToTalkChange: (value: boolean) => void;
  /** Called after a Deepgram key was saved, so a "missing key" error can be cleared. */
  onDeepgramKeySaved: () => void;
}

const ENGINES: { id: SttEngine; title: string; description: string }[] = [
  {
    id: 'flux',
    title: 'Flux',
    description: 'Detects when you finish a thought, so text is pasted in whole sentences.',
  },
  {
    id: 'nova-3',
    title: 'Nova-3',
    description: 'Pastes after short pauses. Formats numbers and dates; say "comma", "period" or "new line" for punctuation.',
  },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  engine,
  onEngineChange,
  toggleShortcut,
  holdShortcut,
  onToggleShortcutChange,
  onHoldShortcutChange,
  pushToTalk,
  onPushToTalkChange,
  onDeepgramKeySaved,
}) => {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [listeningTarget, setListeningTarget] = useState<'toggle' | 'hold' | null>(null);
  const [liveTyping, setLiveTyping] = useState(true);

  useEffect(() => {
    window.electronAPI.getDeepgramApiKey().then(setDeepgramApiKey);
    window.electronAPI.getLiveTyping().then(setLiveTyping);
  }, []);

  const handleLiveTypingChange = (enabled: boolean) => {
    setLiveTyping(enabled);
    window.electronAPI.setLiveTyping(enabled);
  };

  const handleSaveDeepgramKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveMessage('');

    try {
      const result = await window.electronAPI.saveDeepgramApiKey(deepgramApiKey);
      if (result.success) {
        setSaveStatus('success');
        setSaveMessage('Saved');
        onDeepgramKeySaved();
        setTimeout(() => {
          setSaveStatus('idle');
          setSaveMessage('');
        }, 2500);
      } else {
        setSaveStatus('error');
        setSaveMessage(result.error || 'Failed to save');
      }
    } catch (error: any) {
      setSaveStatus('error');
      setSaveMessage(error?.message || 'Failed to save');
    }
  };

  const listenForToggle = useCallback((listening: boolean) => setListeningTarget(listening ? 'toggle' : null), []);
  const listenForHold = useCallback((listening: boolean) => setListeningTarget(listening ? 'hold' : null), []);

  return (
    <div className="settings">
      <section className="settings-section" aria-labelledby="settings-transcription">
        <h2 id="settings-transcription" className="section-heading">Transcription</h2>

        <form className="field" onSubmit={handleSaveDeepgramKey}>
          <label className="field-label" htmlFor="deepgram-key">Deepgram API key</label>
          <div className="input-row">
            <input
              id="deepgram-key"
              type="password"
              className="input input--mono"
              placeholder="Paste your Deepgram API key"
              value={deepgramApiKey}
              onChange={(e) => setDeepgramApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className={`btn ${saveStatus === 'success' ? 'btn-success' : 'btn-primary'}`}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'success' ? 'Saved' : 'Save'}
            </button>
          </div>
          {saveStatus === 'error' ? (
            <p className="field-help field-help--error" role="alert">{saveMessage}</p>
          ) : (
            <p className="field-help">
              Get one at <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer">console.deepgram.com</a>
            </p>
          )}
        </form>

        <div className="field">
          <span className="field-label" id="engine-label">Model</span>
          <div className="choice-cards" role="radiogroup" aria-labelledby="engine-label">
            {ENGINES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={engine === option.id}
                className={`choice-card ${engine === option.id ? 'is-selected' : ''}`}
                onClick={() => onEngineChange(option.id)}
              >
                <span className="choice-card-title">
                  {option.title}
                  {option.id === 'flux' && <span className="badge">Default</span>}
                </span>
                <span className="choice-card-desc">{option.description}</span>
              </button>
            ))}
          </div>
          <p className="field-help">Applies from the next recording.</p>
        </div>

        <div className="field field--row">
          <div>
            <label className="field-label" htmlFor="live-typing">Type as you speak</label>
            <p className="field-help">
              {liveTyping
                ? 'Words appear in your text box as they\'re heard and are corrected in place. If some app misbehaves, turn this off.'
                : 'Each phrase is pasted once Deepgram confirms it. Turn on to see words appear as you speak.'}
            </p>
          </div>
          <Switch.Root
            className="switch-root"
            id="live-typing"
            checked={liveTyping}
            onCheckedChange={handleLiveTypingChange}
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-shortcuts">
        <h2 id="settings-shortcuts" className="section-heading">Shortcuts</h2>

        <ShortcutRecorder
          label="Start / stop recording"
          description="Works from any app. F-keys like F9 are a good choice; plain letters or Space will also type in the focused app."
          value={toggleShortcut}
          emptyText="Not set"
          listeningText="Press keys…"
          isListening={listeningTarget === 'toggle'}
          onListeningChange={listenForToggle}
          onChange={onToggleShortcutChange}
        />

        <ShortcutRecorder
          label="Hold to talk"
          description="Hold to record, release to stop. Try F13–F24, CapsLock, or a key you rarely type."
          value={holdShortcut}
          emptyText="Not set"
          listeningText="Press any key…"
          isListening={listeningTarget === 'hold'}
          onListeningChange={listenForHold}
          onChange={onHoldShortcutChange}
        />

        <div className="field field--row">
          <div>
            <label className="field-label" htmlFor="push-to-talk">Push to talk in the app</label>
            <p className="field-help">Hold the in-app mic button to record instead of clicking it.</p>
          </div>
          <Switch.Root
            className="switch-root"
            id="push-to-talk"
            checked={pushToTalk}
            onCheckedChange={onPushToTalkChange}
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
      </section>

      <DictionarySettings />
    </div>
  );
};
