import React, { useCallback, useEffect, useState } from 'react';
import './styles.css';
import { SearchView } from './SearchView';
import TabBar, { TabType } from './components/TabBar';
import PersistentHeader, { RecordingStatus } from './components/PersistentHeader';
import ContextualFooter from './components/ContextualFooter';
import { RecordingTab, Transcription } from './components/RecordingTab';
import { SettingsTab } from './components/SettingsTab';
import { useRecorder } from './hooks/useRecorder';

const MISSING_KEY_MESSAGE = 'Add your Deepgram API key in Settings to start dictating.';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('recording');
  const [recentTranscriptions, setRecentTranscriptions] = useState<Transcription[]>([]);

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

    loadRecentTranscriptions();

    // Ensure overlay is hidden on start
    window.electronAPI.setOverlayVisible(false);
  }, []);

  const getRecordingStatus = (): RecordingStatus => {
    if (recorder.isRecording) return 'recording';
    if (recorder.isProcessing) return 'processing';
    return 'ready';
  };

  const handleDeepgramKeySaved = () => {
    if (recorder.errorMessage === MISSING_KEY_MESSAGE) {
      recorder.dismissError();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <PersistentHeader
        status={getRecordingStatus()}
        statusText={recorder.status}
        onCommandPaletteClick={() => {
          // TODO: Implement command palette in Phase 3
          console.log('Command palette not yet implemented');
        }}
        onSettingsClick={() => setActiveTab('settings')}
      />

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="tab-content-container">
        <div className={`tab-content ${activeTab === 'recording' ? 'active' : ''}`}>
          <RecordingTab
            isRecording={recorder.isRecording}
            isProcessing={recorder.isProcessing}
            status={recorder.status}
            errorMessage={recorder.errorMessage}
            liveTranscript={recorder.liveTranscript}
            pushToTalk={pushToTalk}
            recentTranscriptions={recentTranscriptions}
            onStart={recorder.startRecording}
            onStop={recorder.stopRecording}
            onCancel={recorder.cancelRecording}
            onDismissError={recorder.dismissError}
          />
        </div>

        <div className={`tab-content ${activeTab === 'history' ? 'active' : ''}`}>
          <SearchView onClose={() => setActiveTab('recording')} />
        </div>

        <div className={`tab-content ${activeTab === 'settings' ? 'active' : ''}`}>
          <SettingsTab
            pushToTalk={pushToTalk}
            onPushToTalkChange={setPushToTalk}
            onDeepgramKeySaved={handleDeepgramKeySaved}
          />
        </div>
      </div>

      <ContextualFooter
        activeTab={activeTab}
        recordingMode={recorder.isRecording ? 'recording' : (recorder.isProcessing ? 'processing' : 'ready')}
      />
    </div>
  );
}
