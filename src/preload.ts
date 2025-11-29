const { contextBridge, ipcRenderer } = require('electron');

export interface IElectronAPI {
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; transcript: string }>;
  formatText: (text: string) => Promise<{ success: boolean; formatted: string }>;
  pasteText: (text: string) => Promise<{ success: boolean }>;
  selectAudioFile: () => Promise<{ cancelled: boolean; filePath: string | null }>;
  onToggleRecording: (callback: () => void) => () => void;
  onStartRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  getShortcuts: () => Promise<{ toggle: string; hold: string }>;
  setToggleShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setHoldShortcut: (shortcut: string) => Promise<{ success: boolean }>;
  setOverlayVisible: (visible: boolean) => void;
  sendAudioData: (data: any) => void;
  onAudioData: (callback: (data: any) => void) => () => void;
  getApiKeyStatus: () => Promise<{ valid: boolean; error: string | null }>;
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
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
