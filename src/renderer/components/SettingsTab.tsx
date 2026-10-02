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
    description: 'Flux detects when you finish a thought.',
  },
  {
    id: 'nova-3',
    title: 'Nova-3',
    description: 'Nova-3 formats numbers and dates and understands spoken punctuation.',
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
  const [voiceCommands, setVoiceCommands] = useState(true);
  const [enterPhrase, setEnterPhrase] = useState('period');
  const [phraseStatus, setPhraseStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    window.electronAPI.getDeepgramApiKey().then(setDeepgramApiKey);
    window.electronAPI.getLiveTyping().then(setLiveTyping);
    window.electronAPI.getVoiceCommands().then(setVoiceCommands);
    window.electronAPI.getEnterPhrase().then(setEnterPhrase);
  }, []);

  const handleVoiceCommandsChange = (enabled: boolean) => {
    setVoiceCommands(enabled);
    window.electronAPI.setVoiceCommands(enabled);
  };

  const handleSaveEnterPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await window.electronAPI.setEnterPhrase(enterPhrase);
    setPhraseStatus(result.success
      ? { ok: true, message: 'Saved' }
      : { ok: false, message: result.error || 'Could not save' });
    if (result.success) setTimeout(() => setPhraseStatus(null), 2000);
  };

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

  const engineInfo = ENGINES.find((option) => option.id === engine) ?? ENGINES[0];

  return (
    <div className="settings">
      <h1 className="large-title">Settings</h1>

      <section className="settings-section" aria-labelledby="settings-transcription">
        <h2 id="settings-transcription" className="group-title">Transcription</h2>
        <div className="grouped">
          <form className="row" onSubmit={handleSaveDeepgramKey}>
            <label className="row-label" htmlFor="deepgram-key">Deepgram API key</label>
            <input
              id="deepgram-key"
              type="password"
              className="row-input input--mono"
              placeholder="Paste key"
              value={deepgramApiKey}
              onChange={(e) => setDeepgramApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="text-btn" disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'success' ? 'Saved' : 'Save'}
            </button>
          </form>

          <div className="row">
            <span className="row-label" id="engine-label">Model</span>
            <div className="segmented segmented--small" role="radiogroup" aria-labelledby="engine-label">
              {ENGINES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={engine === option.id}
                  className="segmented-item"
                  data-state={engine === option.id ? 'active' : 'inactive'}
                  onClick={() => onEngineChange(option.id)}
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <label className="row-label" htmlFor="live-typing">Type as you speak</label>
            <Switch.Root className="switch-root" id="live-typing" checked={liveTyping} onCheckedChange={handleLiveTypingChange}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </div>
        {saveStatus === 'error' ? (
          <p className="group-footnote group-footnote--error" role="alert">{saveMessage}</p>
        ) : (
          <p className="group-footnote">
            {engineInfo.description} {liveTyping ? 'Words appear as you speak and are corrected in place.' : 'Each phrase is pasted once confirmed.'}{' '}
            Get a key at <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer">console.deepgram.com</a>.
          </p>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-voice">
        <h2 id="settings-voice" className="group-title">Voice commands</h2>
        <div className="grouped">
          <div className="row">
            <label className="row-label" htmlFor="voice-commands">Press Enter by voice</label>
            <Switch.Root className="switch-root" id="voice-commands" checked={voiceCommands} onCheckedChange={handleVoiceCommandsChange}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
          {voiceCommands && (
            <form className="row" onSubmit={handleSaveEnterPhrase}>
              <label className="row-label" htmlFor="enter-phrase">Phrase</label>
              <input
                id="enter-phrase"
                type="text"
                className="row-input"
                value={enterPhrase}
                onChange={(e) => {
                  setEnterPhrase(e.target.value);
                  setPhraseStatus(null);
                }}
                placeholder="period"
                spellCheck={false}
              />
              <button type="submit" className="text-btn">{phraseStatus?.ok ? 'Saved' : 'Save'}</button>
            </form>
          )}
        </div>
        {phraseStatus && !phraseStatus.ok ? (
          <p className="group-footnote group-footnote--error" role="alert">{phraseStatus.message}</p>
        ) : (
          <p className="group-footnote">
            Pause, say “{enterPhrase || 'period'}” on its own, then pause again to press Enter. Inside a sentence it’s typed as a normal word.
          </p>
        )}
      </section>

      <section className="settings-section" aria-labelledby="settings-shortcuts">
        <h2 id="settings-shortcuts" className="group-title">Shortcuts</h2>
        <div className="grouped">
          <ShortcutRecorder
            label="Start / stop"
            description="F-keys like F9 work well; plain letters or Space also type in the focused app."
            value={toggleShortcut}
            emptyText="Not set"
            listeningText="Press keys…"
            isListening={listeningTarget === 'toggle'}
            onListeningChange={listenForToggle}
            onChange={onToggleShortcutChange}
          />
          <ShortcutRecorder
            label="Hold to talk"
            description="Hold to record, release to stop. Try F13–F24 or CapsLock."
            value={holdShortcut}
            emptyText="Not set"
            listeningText="Press any key…"
            isListening={listeningTarget === 'hold'}
            onListeningChange={listenForHold}
            onChange={onHoldShortcutChange}
          />
          <div className="row">
            <label className="row-label" htmlFor="push-to-talk">Push to talk in the app</label>
            <Switch.Root className="switch-root" id="push-to-talk" checked={pushToTalk} onCheckedChange={onPushToTalkChange}>
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </div>
        <p className="group-footnote">Shortcuts work from any app. With push to talk, hold the in-app mic button to record.</p>
      </section>

      <DictionarySettings />
    </div>
  );
};
