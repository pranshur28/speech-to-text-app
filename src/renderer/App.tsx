import React, { useCallback, useEffect, useState } from 'react';
import './styles.css';
import { SearchView } from './SearchView';
import TopBar, { TabType } from './components/TopBar';
import ContextualFooter from './components/ContextualFooter';
import { RecordingTab, Transcription } from './components/RecordingTab';
import { SettingsTab } from './components/SettingsTab';
import { useRecorder } from './hooks/useRecorder';
import type { SttEngine } from '../preload';

const MISSING_KEY_MESSAGE = 'Add your Deepgram API key in Settings to start dictating.';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('recording');
  const [recentTranscriptions, setRecentTranscriptions] = useState<Transcription[]>([]);
  const [toggleShortcut, setToggleShortcut] = useState('');
  const [holdShortcut, setHoldShortcut] = useState('');
  const [engine, setEngine] = useState<SttEngine>('flux');

  const [pushToTalk, setPushToTalk] = useState(() => {
    try {
      const saved = localStorage.getItem('pushToTalk');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pushToTalk', JSON.stringify(pushToTalk));
    } catch {
      // Not persisted this session; the default applies next launch
    }
  }, [pushToTalk]);

  const loadRecentTranscriptions = useCallback(() => {
    window.electronAPI.dbGetTranscriptions({ limit: 20 }).then((result) => {
      if (result.success) {
        setRecentTranscriptions(result.transcriptions);
      }
    }).catch((error) => {
      console.error('Error loading transcriptions:', error);
    });
  }, []);

  const recorder = useRecorder({ onSaved: loadRecentTranscriptions });

  useEffect(() => {
    // Without a Deepgram key nothing can be transcribed — send the user to Settings
    window.electronAPI.getDeepgramKeyStatus().then(({ configured }) => {
      if (!configured) {
        recorder.showError(MISSING_KEY_MESSAGE);
        setActiveTab('settings');
      }
    });

    window.electronAPI.getShortcuts().then((shortcuts) => {
      setToggleShortcut(shortcuts.toggle);
      setHoldShortcut(shortcuts.hold);
    });
    window.electronAPI.getSttEngine().then(setEngine);

    loadRecentTranscriptions();

    // Ensure overlay is hidden on start
    window.electronAPI.setOverlayVisible(false);
  }, []);

  const handleToggleShortcutChange = useCallback((shortcut: string) => {
    setToggleShortcut(shortcut);
    window.electronAPI.setToggleShortcut(shortcut);
  }, []);

  const handleHoldShortcutChange = useCallback((shortcut: string) => {
    setHoldShortcut(shortcut);
    window.electronAPI.setHoldShortcut(shortcut);
  }, []);

  const handleEngineChange = useCallback((value: SttEngine) => {
    setEngine(value);
    window.electronAPI.setSttEngine(value);
  }, []);

  const handleDeepgramKeySaved = () => {
    if (recorder.errorMessage === MISSING_KEY_MESSAGE) {
      recorder.dismissError();
    }
  };

  return (
    <div className="app">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        phase={recorder.phase}
        statusText={recorder.status}
        hasError={!!recorder.errorMessage}
        engine={engine}
      />

      <main className="tab-panels">
        <div className={`tab-panel ${activeTab === 'recording' ? 'is-active' : ''}`}>
          <RecordingTab
            isRecording={recorder.isRecording}
            isPaused={recorder.isPaused}
            isProcessing={recorder.isProcessing}
            errorMessage={recorder.errorMessage}
            liveTranscript={recorder.liveTranscript}
            pushToTalk={pushToTalk}
            toggleShortcut={toggleShortcut}
            holdShortcut={holdShortcut}
            recentTranscriptions={recentTranscriptions}
            onStart={recorder.startRecording}
            onStop={recorder.stopRecording}
            onCancel={recorder.cancelRecording}
            onDismissError={recorder.dismissError}
          />
        </div>

        <div className={`tab-panel ${activeTab === 'history' ? 'is-active' : ''}`}>
          <SearchView isActive={activeTab === 'history'} />
        </div>

        <div className={`tab-panel ${activeTab === 'settings' ? 'is-active' : ''}`}>
          <SettingsTab
            engine={engine}
            onEngineChange={handleEngineChange}
            toggleShortcut={toggleShortcut}
            holdShortcut={holdShortcut}
            onToggleShortcutChange={handleToggleShortcutChange}
            onHoldShortcutChange={handleHoldShortcutChange}
            pushToTalk={pushToTalk}
            onPushToTalkChange={setPushToTalk}
            onDeepgramKeySaved={handleDeepgramKeySaved}
          />
        </div>
      </main>

      <ContextualFooter
        activeTab={activeTab}
        isRecording={recorder.isRecording}
        toggleShortcut={toggleShortcut}
        holdShortcut={holdShortcut}
      />
    </div>
  );
}
