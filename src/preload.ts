const { contextBridge, ipcRenderer } = require('electron');

export interface IElectronAPI {
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; transcript: string }>;
  formatText: (text: string) => Promise<{ success: boolean; formatted: string }>;
  pasteText: (text: string) => Promise<{ success: boolean }>;
  selectAudioFile: () => Promise<{ cancelled: boolean; filePath: string | null }>;
  onToggleRecording: (callback: () => void) => () => void;
  onStartRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  onPauseRecording: (callback: () => void) => () => void;
  onResumeRecording: (callback: () => void) => () => void;
  getShortcuts: () => Promise<{ toggle: string; hold: string }>;
  setToggleShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setHoldShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setOverlayVisible: (visible: boolean) => void;
  sendAudioData: (data: any) => void;
  onAudioData: (callback: (data: any) => void) => () => void;
  overlayAction: (action: 'stop' | 'pause' | 'resume') => void;
  setOverlayInteractive: (interactive: boolean) => void;
  getApiKeyStatus: () => Promise<{ valid: boolean; error: string | null }>;
  getApiKey: () => Promise<string>;
  saveApiKey: (apiKey: string) => Promise<{ success: boolean; error: string | null }>;
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
}

const electronAPI: IElectronAPI = {
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
  formatText: (text: string) => ipcRenderer.invoke('format-text', text),
  pasteText: (text: string) => ipcRenderer.invoke('paste-text', text),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
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
  setOverlayVisible: (visible: boolean) => ipcRenderer.send('set-overlay-visible', visible),
  sendAudioData: (data: any) => ipcRenderer.send('audio-data', data),
  onAudioData: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('audio-data', handler);
    return () => ipcRenderer.removeListener('audio-data', handler);
  },
  overlayAction: (action: 'stop' | 'pause' | 'resume') => ipcRenderer.send('overlay-action', action),
  setOverlayInteractive: (interactive: boolean) => ipcRenderer.send('set-overlay-interactive', interactive),
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
