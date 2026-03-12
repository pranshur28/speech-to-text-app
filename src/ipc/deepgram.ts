import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { DeepgramStreamingService } from '../services/deepgram';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerDeepgramHandlers(ctx: ServiceContext) {
  // Serialized paste queue — prevents overlapping clipboard operations
  let pasteQueue: Promise<void> = Promise.resolve();

  ipcMain.handle('deepgram:start-session', async () => {
    try {
      const apiKey = ctx.getConfigService().getDeepgramApiKey();
      if (!apiKey) {
        return { success: false, error: 'Deepgram API key not configured' };
      }

      // Stop existing session if any
      const existing = ctx.getDeepgramService();
      if (existing) {
        try { await existing.stopSession(); } catch (e) { /* ignore */ }
      }

      // Reset paste queue for new session
      pasteQueue = Promise.resolve();

      const svc = new DeepgramStreamingService(apiKey);
      ctx.setDeepgramService(svc);

      // Forward live transcript chunks to the renderer, and paste finals immediately
      svc.setTranscriptCallback((text, isFinal) => {
        const mainWindow = ctx.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('deepgram:transcript', { text, isFinal });
        }

        // Paste finalized phrases into the focused app via clipboard (Ctrl+V).
        // Serialized so operations never overlap.
        if (isFinal && text.trim()) {
          pasteQueue = pasteQueue.then(async () => {
            const pasteService = ctx.getPasteService();
            if (!pasteService) return;
            let toPaste = text;
            const dict = ctx.getDictionaryService();
            if (dict) {
              toPaste = dict.applyReplacements(toPaste);
            }
            try {
              await pasteService.paste(toPaste + ' ');
            } catch (err) {
              log.error('Error pasting live transcript:', err);
            }
          });
        }
      });

      await svc.startSession();
      return { success: true };
    } catch (error: any) {
      log.error('Error starting Deepgram session:', error);
      return { success: false, error: error?.message || 'Failed to start Deepgram session' };
    }
  });

  ipcMain.on('deepgram:audio-chunk', (_event: IpcMainEvent, data: ArrayBuffer) => {
    const svc = ctx.getDeepgramService();
    if (svc) {
      svc.sendAudio(Buffer.from(data));
    }
  });

  ipcMain.handle('deepgram:stop-session', async (_event: IpcMainInvokeEvent) => {
    const deepgramService = ctx.getDeepgramService();
    if (!deepgramService) {
      return { success: false, transcript: '', formatted: '', error: 'No active Deepgram session' };
    }

    try {
      const transcript = await deepgramService.stopSession();
      ctx.setDeepgramService(null);

      if (!transcript || transcript.trim().length === 0) {
        return { success: true, transcript: '', formatted: '' };
      }

      // Text was already pasted live during recording.
      // Apply dictionary replacements for the saved version.
      let finalText = transcript;
      const dictionaryService = ctx.getDictionaryService();
      if (dictionaryService) {
        finalText = dictionaryService.applyReplacements(transcript);
      }

      // Save to database
      const databaseService = ctx.getDatabaseService();
      if (databaseService) {
        databaseService.saveTranscription({
          raw_text: transcript,
          formatted_text: finalText,
          timestamp: Date.now(),
          formatting_profile: 'casual',
          is_favorite: 0,
        });
      }

      return { success: true, transcript, formatted: finalText };
    } catch (error: any) {
      log.error('Error stopping Deepgram session:', error);
      ctx.setDeepgramService(null);
      throw error;
    }
  });

  ipcMain.handle('save-deepgram-api-key', (_event: IpcMainInvokeEvent, apiKey: string) => {
    ctx.getConfigService().setDeepgramApiKey(apiKey);
    return { success: true, error: null };
  });

  ipcMain.handle('get-deepgram-api-key', () => {
    return ctx.getConfigService().getDeepgramApiKey() || '';
  });
}
