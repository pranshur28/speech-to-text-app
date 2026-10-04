import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { DeepgramStreamingService } from '../services/deepgram';
import { SttEngine } from '../services/config';
import { HeldModifiers, LiveTyper } from '../services/live-typer';
import { isEnterCommand, joinWithCommands } from '../services/voice-commands';
import log from '../utils/logger';
import { ServiceContext } from './types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NO_MODIFIERS: HeldModifiers = { ctrlHeld: false, shiftHeld: false, altHeld: false, metaHeld: false };

export function registerDeepgramHandlers(ctx: ServiceContext) {
  // Serialized paste queue — prevents overlapping clipboard operations
  let pasteQueue: Promise<void> = Promise.resolve();
  // Paste mode separates phrases with a leading space, like live typing
  let pasteNeedsSeparator = false;

  // Live typing for the current session (null when "paste when confirmed" mode is used)
  let liveTyper: LiveTyper | null = null;

  const sendToMain = (channel: string, payload: unknown) => {
    const mainWindow = ctx.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  // Run our synthetic input with hotkey tracking ignoring it. `fn` gets the modifiers
  // physically held; during hold-to-talk they are lifted first, so it sees none.
  const runInput = async <T>(fn: (held: HeldModifiers) => Promise<T>): Promise<T> => {
    const shortcutMgr = ctx.getShortcutManager();
    const held = shortcutMgr.enterPasteMode();
    const lifted = shortcutMgr.liftHeldModifiers();
    try {
      return await fn(lifted ? NO_MODIFIERS : held);
    } finally {
      lifted?.restore();
      shortcutMgr.exitPasteMode();
    }
  };

  const createLiveTyper = () => new LiveTyper({
    runInput,
    typeText: (text) => ctx.getPasteService()!.typeText(text),
    pasteText: (text) => ctx.getPasteService()!.paste(text),
    pressBackspace: (count) => ctx.getPasteService()!.pressBackspace(count),
    pressEnter: () => ctx.getPasteService()!.pressEnter(),
    getActiveWindowId: () => ctx.getPasteService()!.getActiveWindowId(),
    transform: (text) => ctx.getDictionaryService()?.applyReplacements(text) ?? text,
    enterPhrase: ctx.getConfigService().getActiveEnterPhrase(),
  });

  // Paste a finalized phrase into the focused app via clipboard (Ctrl+V), one at a time
  const queuePaste = (phrase: string) => {
    pasteQueue = pasteQueue.then(async () => {
      const pasteService = ctx.getPasteService();
      if (!pasteService) return;

      // The Enter phrase said on its own presses Enter instead of being pasted
      const enterPhrase = ctx.getConfigService().getActiveEnterPhrase();
      const command = enterPhrase && isEnterCommand(phrase, enterPhrase) ? 'enter' : null;
      const text = command ? '' : phrase;
      const replaced = ctx.getDictionaryService()?.applyReplacements(text) ?? text;

      try {
        if (replaced) {
          // Held modifiers are passed on so paste doesn't release the user's physical keys
          await runInput((held) => pasteService.paste((pasteNeedsSeparator ? ' ' : '') + replaced, held));
          pasteNeedsSeparator = true;
        }

        if (command === 'enter') {
          // Never press Enter while a modifier is held (it would become Ctrl+Enter etc.)
          for (;;) {
            const pressed = await runInput(async (held) => {
              if (held.ctrlHeld || held.shiftHeld || held.altHeld || held.metaHeld) return false;
              await pasteService.pressEnter();
              return true;
            });
            if (pressed) break;
            await sleep(40);
          }
          pasteNeedsSeparator = false;
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
    pasteNeedsSeparator = false;
    liveTyper?.reset();
    liveTyper = ctx.getConfigService().getLiveTyping() ? createLiveTyper() : null;

    const engine = ctx.getConfigService().getSttEngine();
    // The Enter phrase goes first so the keyterm budget can never drop it
    const enterPhrase = ctx.getConfigService().getActiveEnterPhrase();
    const dictionaryTerms = ctx.getDictionaryService()?.getKeyterms().terms ?? [];
    const keyterms = enterPhrase
      ? [enterPhrase, ...dictionaryTerms.filter((term) => term.toLowerCase() !== enterPhrase.toLowerCase())]
      : dictionaryTerms;
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

      // Text was already typed/pasted live during recording. For the saved copy, voice
      // commands become line breaks and dictionary replacements apply to the whole text.
      const spoken = joinWithCommands(deepgramService.getFinals(), ctx.getConfigService().getActiveEnterPhrase());
      if (!transcript || spoken.trim().length === 0) {
        return { success: true, transcript: transcript || '', formatted: '' };
      }
      const finalText = ctx.getDictionaryService()?.applyReplacements(spoken) ?? spoken;

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

  ipcMain.handle('get-voice-commands', () => {
    return ctx.getConfigService().getVoiceCommands();
  });

  ipcMain.handle('set-voice-commands', (_event: IpcMainInvokeEvent, enabled: boolean) => {
    ctx.getConfigService().setVoiceCommands(!!enabled);
    return { success: true };
  });

  ipcMain.handle('get-enter-phrase', () => {
    return ctx.getConfigService().getEnterPhrase();
  });

  ipcMain.handle('set-enter-phrase', (_event: IpcMainInvokeEvent, phrase: string) => {
    const trimmed = (phrase || '').trim();
    if (!/[\p{L}\p{N}]/u.test(trimmed) || trimmed.split(/\s+/).length > 3) {
      return { success: false, error: 'Use one to three words' };
    }
    ctx.getConfigService().setEnterPhrase(trimmed);
    return { success: true, error: null };
  });
}
