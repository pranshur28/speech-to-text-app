import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TranscriptionInsert } from '../services/database';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerDatabaseHandlers(ctx: ServiceContext) {
  ipcMain.handle('db:save-transcription', (_event: IpcMainInvokeEvent, data: TranscriptionInsert) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      const id = db.saveTranscription(data);
      return { success: true, id };
    } catch (error) {
      log.error('Error saving transcription:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-transcription', (_event: IpcMainInvokeEvent, id: number) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      const transcription = db.getTranscription(id);
      return { success: true, transcription };
    } catch (error) {
      log.error('Error getting transcription:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-transcriptions', (_event: IpcMainInvokeEvent, filters?: any) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      const transcriptions = db.getTranscriptions(filters || {});
      return { success: true, transcriptions };
    } catch (error) {
      log.error('Error getting transcriptions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:search', (_event: IpcMainInvokeEvent, query: string, filters?: any) => {
    const searchService = ctx.getSearchService();
    if (!searchService) throw new Error('Search service not initialized');
    try {
      const result = searchService.search({ query, filters });
      return { success: true, ...result };
    } catch (error) {
      log.error('Error searching transcriptions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:update-transcription', (_event: IpcMainInvokeEvent, id: number, updates: any) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      db.updateTranscription(id, updates);
      return { success: true };
    } catch (error) {
      log.error('Error updating transcription:', error);
      throw error;
    }
  });

  ipcMain.handle('db:delete-transcription', (_event: IpcMainInvokeEvent, id: number) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      db.deleteTranscription(id);
      return { success: true };
    } catch (error) {
      log.error('Error deleting transcription:', error);
      throw error;
    }
  });

  ipcMain.handle('db:toggle-favorite', (_event: IpcMainInvokeEvent, id: number) => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      db.toggleFavorite(id);
      return { success: true };
    } catch (error) {
      log.error('Error toggling favorite:', error);
      throw error;
    }
  });

  ipcMain.handle('db:export', (_event: IpcMainInvokeEvent, ids: number[], format: 'json' | 'markdown' | 'txt') => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      const data = db.exportTranscriptions(ids, format);
      return { success: true, data };
    } catch (error) {
      log.error('Error exporting transcriptions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-stats', () => {
    const db = ctx.getDatabaseService();
    if (!db) throw new Error('Database service not initialized');
    try {
      const stats = db.getStats();
      return { success: true, stats };
    } catch (error) {
      log.error('Error getting stats:', error);
      throw error;
    }
  });
}
