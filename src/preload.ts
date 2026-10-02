const { contextBridge, ipcRenderer } = require('electron');

export type SttEngine = 'flux' | 'nova-3';

export type OverlayPhase = 'hidden' | 'connecting' | 'listening' | 'paused' | 'finishing';

export interface OverlayState {
  phase: OverlayPhase;
  /** Hold-to-talk: releasing the key stops, so the pill shows no pause/stop buttons. */
  holdMode: boolean;
}

export interface IElectronAPI {
  onToggleRecording: (callback: () => void) => () => void;
  onStartRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  onPauseRecording: (callback: () => void) => () => void;
  onResumeRecording: (callback: () => void) => () => void;
  getShortcuts: () => Promise<{ toggle: string; hold: string }>;
  setToggleShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setHoldShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setOverlayState: (state: OverlayState) => void;
  sendAudioData: (data: any) => void;
  onAudioData: (callback: (data: any) => void) => () => void;
  overlayAction: (action: 'stop' | 'pause' | 'resume') => void;
  setOverlayInteractive: (interactive: boolean) => void;
  onOverlayState: (callback: (state: OverlayState) => void) => () => void;
  overlayReady: () => void;
  // Database API
  dbSaveTranscription: (data: any) => Promise<{ success: boolean; id: number }>;
  dbGetTranscription: (id: number) => Promise<{ success: boolean; transcription: any }>;
  dbGetTranscriptions: (filters?: any) => Promise<{ success: boolean; transcriptions: any[] }>;
  dbSearch: (query: string, filters?: any) => Promise<{ success: boolean; transcriptions: any[]; total: number; hasMore: boolean }>;
  dbUpdateTranscription: (id: number, updates: any) => Promise<{ success: boolean }>;
  dbDeleteTranscription: (id: number) => Promise<{ success: boolean }>;
  dbToggleFavorite: (id: number) => Promise<{ success: boolean }>;
  dbExport: (ids: number[], format: 'json' | 'markdown' | 'txt') => Promise<{ success: boolean; data: string }>;
  dbGetStats: () => Promise<{ success: boolean; stats: { total: number; favorites: number; totalTags: number } }>;
  // Dictionary API
  dictAddEntry: (data: { spoken_phrase: string; replacement: string; is_case_sensitive?: boolean }) => Promise<{ success: boolean; id?: number; error?: string }>;
  dictGetEntries: () => Promise<{ success: boolean; entries: any[] }>;
  dictGetEntry: (id: number) => Promise<{ success: boolean; entry: any }>;
  dictUpdateEntry: (id: number, updates: any) => Promise<{ success: boolean }>;
  dictDeleteEntry: (id: number) => Promise<{ success: boolean }>;
  dictToggleEnabled: (id: number) => Promise<{ success: boolean }>;
  dictApplyReplacements: (text: string) => Promise<{ success: boolean; result: string }>;
  dictGetStats: () => Promise<{ success: boolean; stats: { total: number; enabled: number } }>;
  dictGetKeyterms: () => Promise<{ success: boolean; terms: string[]; estimatedTokens: number; dropped: number }>;
  // Deepgram Streaming API
  deepgramStartSession: () => Promise<{ success: boolean; error?: string }>;
  deepgramSendAudioChunk: (data: ArrayBuffer) => void;
  deepgramStopSession: () => Promise<{ success: boolean; transcript: string; formatted: string; error?: string }>;
  deepgramCancelSession: () => Promise<{ success: boolean }>;
  onDeepgramConnectionLost: (callback: (data: { message: string }) => void) => () => void;
  getDeepgramKeyStatus: () => Promise<{ configured: boolean }>;
  getDeepgramApiKey: () => Promise<string>;
  saveDeepgramApiKey: (key: string) => Promise<{ success: boolean; error: string | null }>;
  getSttEngine: () => Promise<SttEngine>;
  setSttEngine: (engine: SttEngine) => Promise<{ success: boolean }>;
  getLiveTyping: () => Promise<boolean>;
  setLiveTyping: (enabled: boolean) => Promise<{ success: boolean }>;
  getVoiceCommands: () => Promise<boolean>;
  setVoiceCommands: (enabled: boolean) => Promise<{ success: boolean }>;
}

const electronAPI: IElectronAPI = {
  onToggleRecording: (callback: () => void) => {
    ipcRenderer.on('toggle-recording', callback);
    return () => ipcRenderer.removeListener('toggle-recording', callback);
  },
  onStartRecording: (callback: () => void) => {
    ipcRenderer.on('start-recording', callback);
    return () => ipcRenderer.removeListener('start-recording', callback);
  },
  onStopRecording: (callback: () => void) => {
    ipcRenderer.on('stop-recording', callback);
    return () => ipcRenderer.removeListener('stop-recording', callback);
  },
  onPauseRecording: (callback: () => void) => {
    ipcRenderer.on('pause-recording', callback);
    return () => ipcRenderer.removeListener('pause-recording', callback);
  },
  onResumeRecording: (callback: () => void) => {
    ipcRenderer.on('resume-recording', callback);
    return () => ipcRenderer.removeListener('resume-recording', callback);
  },
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  setToggleShortcut: (shortcut: string) => ipcRenderer.invoke('set-toggle-shortcut', shortcut),
  setHoldShortcut: (shortcut: string) => ipcRenderer.invoke('set-hold-shortcut', shortcut),
  setOverlayState: (state: OverlayState) => ipcRenderer.send('overlay:set-state', state),
  sendAudioData: (data: any) => ipcRenderer.send('audio-data', data),
  onAudioData: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('audio-data', handler);
    return () => ipcRenderer.removeListener('audio-data', handler);
  },
  overlayAction: (action: 'stop' | 'pause' | 'resume') => ipcRenderer.send('overlay-action', action),
  setOverlayInteractive: (interactive: boolean) => ipcRenderer.send('set-overlay-interactive', interactive),
  onOverlayState: (callback: (state: OverlayState) => void) => {
    const handler = (_event: any, state: OverlayState) => callback(state);
    ipcRenderer.on('overlay:state', handler);
    return () => ipcRenderer.removeListener('overlay:state', handler);
  },
  overlayReady: () => ipcRenderer.send('overlay:ready'),
  // Database API
  dbSaveTranscription: (data: any) => ipcRenderer.invoke('db:save-transcription', data),
  dbGetTranscription: (id: number) => ipcRenderer.invoke('db:get-transcription', id),
  dbGetTranscriptions: (filters?: any) => ipcRenderer.invoke('db:get-transcriptions', filters),
  dbSearch: (query: string, filters?: any) => ipcRenderer.invoke('db:search', query, filters),
  dbUpdateTranscription: (id: number, updates: any) => ipcRenderer.invoke('db:update-transcription', id, updates),
  dbDeleteTranscription: (id: number) => ipcRenderer.invoke('db:delete-transcription', id),
  dbToggleFavorite: (id: number) => ipcRenderer.invoke('db:toggle-favorite', id),
  dbExport: (ids: number[], format: 'json' | 'markdown' | 'txt') => ipcRenderer.invoke('db:export', ids, format),
  dbGetStats: () => ipcRenderer.invoke('db:get-stats'),
  // Dictionary API
  dictAddEntry: (data: { spoken_phrase: string; replacement: string; is_case_sensitive?: boolean }) => ipcRenderer.invoke('dict:add-entry', data),
  dictGetEntries: () => ipcRenderer.invoke('dict:get-entries'),
  dictGetEntry: (id: number) => ipcRenderer.invoke('dict:get-entry', id),
  dictUpdateEntry: (id: number, updates: any) => ipcRenderer.invoke('dict:update-entry', id, updates),
  dictDeleteEntry: (id: number) => ipcRenderer.invoke('dict:delete-entry', id),
  dictToggleEnabled: (id: number) => ipcRenderer.invoke('dict:toggle-enabled', id),
  dictApplyReplacements: (text: string) => ipcRenderer.invoke('dict:apply-replacements', text),
  dictGetStats: () => ipcRenderer.invoke('dict:get-stats'),
  dictGetKeyterms: () => ipcRenderer.invoke('dict:get-keyterms'),
  // Deepgram Streaming API
  deepgramStartSession: () => ipcRenderer.invoke('deepgram:start-session'),
  deepgramSendAudioChunk: (data: ArrayBuffer) => ipcRenderer.send('deepgram:audio-chunk', data),
  deepgramStopSession: () => ipcRenderer.invoke('deepgram:stop-session'),
  deepgramCancelSession: () => ipcRenderer.invoke('deepgram:cancel-session'),
  onDeepgramConnectionLost: (callback: (data: { message: string }) => void) => {
    const handler = (_event: any, data: { message: string }) => callback(data);
    ipcRenderer.on('deepgram:connection-lost', handler);
    return () => ipcRenderer.removeListener('deepgram:connection-lost', handler);
  },
  getDeepgramKeyStatus: () => ipcRenderer.invoke('get-deepgram-key-status'),
  getDeepgramApiKey: () => ipcRenderer.invoke('get-deepgram-api-key'),
  saveDeepgramApiKey: (key: string) => ipcRenderer.invoke('save-deepgram-api-key', key),
  getSttEngine: () => ipcRenderer.invoke('get-stt-engine'),
  setSttEngine: (engine: SttEngine) => ipcRenderer.invoke('set-stt-engine', engine),
  getLiveTyping: () => ipcRenderer.invoke('get-live-typing'),
  setLiveTyping: (enabled: boolean) => ipcRenderer.invoke('set-live-typing', enabled),
  getVoiceCommands: () => ipcRenderer.invoke('get-voice-commands'),
  setVoiceCommands: (enabled: boolean) => ipcRenderer.invoke('set-voice-commands', enabled),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
