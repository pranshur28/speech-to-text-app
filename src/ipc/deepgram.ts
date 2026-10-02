import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { DeepgramStreamingService } from '../services/deepgram';
import { SttEngine } from '../services/config';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerDeepgramHandlers(ctx: ServiceContext) {
  // Serialized paste queue — prevents overlapping clipboard operations
  let pasteQueue: Promise<void> = Promise.resolve();

  const sendToMain = (channel: string, payload: unknown) => {
    const mainWindow = ctx.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  // Paste a finalized phrase into the focused app via clipboard (Ctrl+V), one at a time
  const queuePaste = (text: string) => {
    pasteQueue = pasteQueue.then(async () => {
      const pasteService = ctx.getPasteService();
      if (!pasteService) return;
      const toPaste = ctx.getDictionaryService()?.applyReplacements(text) ?? text;
      try {
        // Enter paste mode: freeze hotkey tracking and get currently held modifiers
        // so paste doesn't corrupt key state or release user's physical modifier keys
        const shortcutMgr = ctx.getShortcutManager();
        const heldModifiers = shortcutMgr.enterPasteMode();
        try {
          await pasteService.paste(toPaste + ' ', heldModifiers);
        } finally {
          shortcutMgr.exitPasteMode();
        }
      } catch (err) {
        log.error('Error pasting live transcript:', err);
      }
    });
  };

  ipcMain.handle('deepgram:start-session', async () => {
    const apiKey = ctx.getConfigService().getDeepgramApiKey();
    if (!apiKey) {
      return { success: false, error: 'Add your Deepgram API key in Settings.' };
    }

    // Stop existing session if any
    const existing = ctx.getDeepgramService();
    if (existing) {
      ctx.setDeepgramService(null);
      try { await existing.stopSession(); } catch (e) { /* ignore */ }
    }

    // Reset paste queue for new session
    pasteQueue = Promise.resolve();

    const engine = ctx.getConfigService().getSttEngine();
    const keyterms = ctx.getDictionaryService()?.getKeyterms().terms ?? [];
    const svc = new DeepgramStreamingService(apiKey, engine, keyterms);

    // Forward live transcript chunks to the renderer, and paste finals immediately
    svc.setTranscriptCallback((text, isFinal) => {
      sendToMain('deepgram:transcript', { text, isFinal });
      if (isFinal && text.trim()) {
        queuePaste(text);
      }
    });

    svc.setDisconnectCallback((message) => {
      log.warn('Deepgram session interrupted:', message);
      sendToMain('deepgram:connection-lost', { message });
    });

    try {
      await svc.startSession();
    } catch (error: any) {
      log.error('Error starting Deepgram session:', error);
      return { success: false, error: error?.message || 'Failed to start Deepgram session' };
    }

    ctx.setDeepgramService(svc);
    return { success: true };
  });

  ipcMain.on('deepgram:audio-chunk', (_event: IpcMainEvent, data: ArrayBuffer) => {
    ctx.getDeepgramService()?.sendAudio(Buffer.from(data));
  });

  ipcMain.handle('deepgram:stop-session', async (_event: IpcMainInvokeEvent) => {
    const deepgramService = ctx.getDeepgramService();
    if (!deepgramService) {
      return { success: false, transcript: '', formatted: '', error: 'No active Deepgram session' };
    }
    ctx.setDeepgramService(null);

    try {
      const transcript = await deepgramService.stopSession();
      // Let the last phrase finish pasting before reporting done
      await pasteQueue;

      if (!transcript || transcript.trim().length === 0) {
        return { success: true, transcript: '', formatted: '' };
      }

      // Text was already pasted live during recording.
      // Apply dictionary replacements to the full transcript for the saved version.
      const finalText = ctx.getDictionaryService()?.applyReplacements(transcript) ?? transcript;

      ctx.getDatabaseService()?.saveTranscription({
        raw_text: transcript,
        formatted_text: finalText,
        timestamp: Date.now(),
        formatting_profile: 'casual',
        is_favorite: 0,
      });

      return { success: true, transcript, formatted: finalText };
    } catch (error: any) {
      log.error('Error stopping Deepgram session:', error);
      throw error;
    }
  });

  // Close the session without saving (phrases already pasted stay where they are)
  ipcMain.handle('deepgram:cancel-session', async () => {
    const deepgramService = ctx.getDeepgramService();
    ctx.setDeepgramService(null);
    if (deepgramService) {
      try { await deepgramService.stopSession(); } catch (e) { /* ignore */ }
    }
    return { success: true };
  });

  ipcMain.handle('get-deepgram-key-status', () => {
    return { configured: !!ctx.getConfigService().getDeepgramApiKey() };
  });

  ipcMain.handle('save-deepgram-api-key', (_event: IpcMainInvokeEvent, apiKey: string) => {
    const trimmed = (apiKey || '').trim();
    if (!trimmed) {
      return { success: false, error: 'API key cannot be empty' };
    }
    ctx.getConfigService().setDeepgramApiKey(trimmed);
    return { success: true, error: null };
  });

  ipcMain.handle('get-deepgram-api-key', () => {
    return ctx.getConfigService().getDeepgramApiKey() || '';
  });

  ipcMain.handle('get-stt-engine', () => {
    return ctx.getConfigService().getSttEngine();
  });

  ipcMain.handle('set-stt-engine', (_event: IpcMainInvokeEvent, engine: SttEngine) => {
    if (engine !== 'flux' && engine !== 'nova-3') {
      return { success: false };
    }
    ctx.getConfigService().setSttEngine(engine);
    return { success: true };
  });
}
