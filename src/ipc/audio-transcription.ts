import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerAudioTranscriptionHandlers(ctx: ServiceContext) {
  ipcMain.handle('transcribe-audio', async (_event: IpcMainInvokeEvent, audioBuffer: ArrayBuffer) => {
    const transcriptionService = ctx.getTranscriptionService();
    if (!transcriptionService) throw new Error('Transcription service not initialized');
    try {
      const transcript = await transcriptionService.transcribe(Buffer.from(audioBuffer));
      return { success: true, transcript };
    } catch (error) {
      log.error('Error transcribing:', error);
      throw error;
    }
  });

  ipcMain.handle('format-text', async (_event: IpcMainInvokeEvent, text: string) => {
    const textFormatter = ctx.getTextFormatter();
    if (!textFormatter) throw new Error('Text formatter not initialized');
    try {
      const formatted = await textFormatter.format(text);
      return { success: true, formatted };
    } catch (error) {
      log.error('Error formatting:', error);
      throw error;
    }
  });

  ipcMain.handle('transcribe-and-type-segment', async (event: IpcMainInvokeEvent, audioBuffer: ArrayBuffer) => {
    const transcriptionService = ctx.getTranscriptionService();
    const textFormatter = ctx.getTextFormatter();
    const pasteService = ctx.getPasteService();
    if (!transcriptionService) throw new Error('Transcription service not initialized');
    if (!textFormatter) throw new Error('Text formatter not initialized');
    if (!pasteService) throw new Error('Paste service not initialized');
    try {
      const transcript = await transcriptionService.transcribe(Buffer.from(audioBuffer));
      if (!transcript || transcript.trim().length === 0) {
        return { success: true, transcript: '', formatted: '' };
      }
      let fullText = '';
      for await (const chunk of textFormatter.formatStream(transcript)) {
        fullText += chunk;
        await pasteService.typeText(chunk);
        event.sender.send('stream-chunk', chunk);
      }
      return { success: true, transcript, formatted: fullText };
    } catch (error) {
      log.error('Error in transcribe-and-type-segment:', error);
      throw error;
    }
  });

  ipcMain.handle('format-and-type-stream', async (event: IpcMainInvokeEvent, rawText: string) => {
    const textFormatter = ctx.getTextFormatter();
    const pasteService = ctx.getPasteService();
    if (!textFormatter) throw new Error('Text formatter not initialized');
    if (!pasteService) throw new Error('Paste service not initialized');
    try {
      let fullText = '';
      for await (const chunk of textFormatter.formatStream(rawText)) {
        fullText += chunk;
        await pasteService.typeText(chunk);
        event.sender.send('stream-chunk', chunk);
      }
      return { success: true, formatted: fullText };
    } catch (error) {
      log.error('Error in streaming format+type:', error);
      throw error;
    }
  });

  ipcMain.handle('paste-text', async (_event: IpcMainInvokeEvent, text: string) => {
    const pasteService = ctx.getPasteService();
    if (!pasteService) throw new Error('Paste service not initialized');
    try {
      await pasteService.paste(text);
      return { success: true };
    } catch (error) {
      log.error('Error pasting:', error);
      throw error;
    }
  });

  ipcMain.handle('select-audio-file', async () => {
    const mainWindow = ctx.getMainWindow();
    if (!mainWindow) throw new Error('Window not initialized');
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      return { cancelled: result.canceled, filePath: result.filePaths[0] || null };
    } catch (error) {
      log.error('Error selecting file:', error);
      throw error;
    }
  });
}
