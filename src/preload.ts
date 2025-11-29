const { contextBridge, ipcRenderer } = require('electron');

export interface IElectronAPI {
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; transcript: string }>;
  formatText: (text: string) => Promise<{ success: boolean; formatted: string }>;
  pasteText: (text: string) => Promise<{ success: boolean }>;
  selectAudioFile: () => Promise<{ cancelled: boolean; filePath: string | null }>;
  onToggleRecording: (callback: () => void) => void;
}

const electronAPI: IElectronAPI = {
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
  formatText: (text: string) => ipcRenderer.invoke('format-text', text),
  pasteText: (text: string) => ipcRenderer.invoke('paste-text', text),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  onToggleRecording: (callback: () => void) => {
    ipcRenderer.on('toggle-recording', callback);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
