import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TranscriptionService } from '../services/transcription';
import { TextFormatter } from '../services/formatter';
import { ServiceContext } from './types';

export function registerApiKeyHandlers(ctx: ServiceContext) {
  ipcMain.handle('get-api-key-status', () => {
    const configService = ctx.getConfigService();
    const apiKey = configService.getApiKey() || '';
    if (!apiKey) {
      return { valid: false, error: 'API key not configured' };
    }
    if (!apiKey.startsWith('sk-')) {
      return { valid: false, error: 'Invalid API key format' };
    }
    return { valid: true, error: null };
  });

  ipcMain.handle('get-api-key', () => {
    return ctx.getConfigService().getApiKey() || '';
  });

  ipcMain.handle('save-api-key', (_event: IpcMainInvokeEvent, apiKey: string) => {
    const configService = ctx.getConfigService();

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return { success: false, error: 'Invalid API key format. Key should start with "sk-"' };
    }

    configService.setApiKey(apiKey);

    // Reinitialize services with new API key
    ctx.setTranscriptionService(new TranscriptionService(apiKey));
    ctx.setTextFormatter(new TextFormatter(apiKey));

    return { success: true, error: null };
  });
}
