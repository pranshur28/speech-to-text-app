import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { DeepgramStreamingService } from '../services/deepgram';
import { SttEngine } from '../services/config';
import { LiveTyper } from '../services/live-typer';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerDeepgramHandlers(ctx: ServiceContext) {
  // Serialized paste queue — prevents overlapping clipboard operations
  let pasteQueue: Promise<void> = Promise.resolve();

  // Live typing for the current session (null when "paste when confirmed" mode is used)
  let liveTyper: LiveTyper | null = null;

  const sendToMain = (channel: string, payload: unknown) => {
    const mainWindow = ctx.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  const createLiveTyper = () => new LiveTyper({
    // Hotkey tracking ignores our own keystrokes while input runs
    runInput: async (fn) => {
      const shortcutMgr = ctx.getShortcutManager();
      const held = shortcutMgr.enterPasteMode();
      try {
        return await fn(held);
      } finally {
        shortcutMgr.exitPasteMode();
      }
    },
    typeText: (text) => ctx.getPasteService()!.typeText(text),
    pasteText: (text) => ctx.getPasteService()!.paste(text),
    pressBackspace: (count) => ctx.getPasteService()!.pressBackspace(count),
    getActiveWindowId: () => ctx.getPasteService()!.getActiveWindowId(),
    transform: (text) => ctx.getDictionaryService()?.applyReplacements(text) ?? text,
  });

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

    // Reset output state for the new session
    pasteQueue = Promise.resolve();
    liveTyper?.reset();
    liveTyper = ctx.getConfigService().getLiveTyping() ? createLiveTyper() : null;

    const engine = ctx.getConfigService().getSttEngine();
    const keyterms = ctx.getDictionaryService()?.getKeyterms().terms ?? [];
    const svc = new DeepgramStreamingService(apiKey, engine, keyterms);

    // Live typing: every guess is typed and corrected in place.
    // Otherwise: paste each phrase once Deepgram confirms it.
    svc.setTranscriptCallback((text, isFinal) => {
      if (liveTyper) {
        liveTyper.update(text, isFinal);
      } else if (isFinal && text.trim()) {
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
      // Let the last phrase finish typing/pasting before reporting done
      await pasteQueue;
      await liveTyper?.flush();

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

  // Close the session without saving (text already typed/pasted stays where it is)
  ipcMain.handle('deepgram:cancel-session', async () => {
    const deepgramService = ctx.getDeepgramService();
    ctx.setDeepgramService(null);
    liveTyper?.reset();
    liveTyper = null;
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

  ipcMain.handle('get-live-typing', () => {
    return ctx.getConfigService().getLiveTyping();
  });

  ipcMain.handle('set-live-typing', (_event: IpcMainInvokeEvent, enabled: boolean) => {
    ctx.getConfigService().setLiveTyping(!!enabled);
    return { success: true };
  });
}
