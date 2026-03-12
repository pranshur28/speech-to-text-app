import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { DictionaryEntryInsert } from '../services/dictionary';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerDictionaryHandlers(ctx: ServiceContext) {
  ipcMain.handle('dict:add-entry', (_event: IpcMainInvokeEvent, data: DictionaryEntryInsert) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      const id = dict.addEntry(data);
      return { success: true, id };
    } catch (error: any) {
      log.error('Error adding dictionary entry:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        return { success: false, error: 'An entry with this phrase already exists' };
      }
      throw error;
    }
  });

  ipcMain.handle('dict:get-entries', () => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      const entries = dict.getAllEntries();
      return { success: true, entries };
    } catch (error) {
      log.error('Error getting dictionary entries:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:get-entry', (_event: IpcMainInvokeEvent, id: number) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      const entry = dict.getEntry(id);
      return { success: true, entry };
    } catch (error) {
      log.error('Error getting dictionary entry:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:update-entry', (_event: IpcMainInvokeEvent, id: number, updates: Partial<DictionaryEntryInsert> & { is_enabled?: boolean }) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      dict.updateEntry(id, updates);
      return { success: true };
    } catch (error) {
      log.error('Error updating dictionary entry:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:delete-entry', (_event: IpcMainInvokeEvent, id: number) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      dict.deleteEntry(id);
      return { success: true };
    } catch (error) {
      log.error('Error deleting dictionary entry:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:toggle-enabled', (_event: IpcMainInvokeEvent, id: number) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      dict.toggleEnabled(id);
      return { success: true };
    } catch (error) {
      log.error('Error toggling dictionary entry:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:apply-replacements', (_event: IpcMainInvokeEvent, text: string) => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      const result = dict.applyReplacements(text);
      return { success: true, result };
    } catch (error) {
      log.error('Error applying dictionary replacements:', error);
      throw error;
    }
  });

  ipcMain.handle('dict:get-stats', () => {
    const dict = ctx.getDictionaryService();
    if (!dict) throw new Error('Dictionary service not initialized');
    try {
      const stats = dict.getStats();
      return { success: true, stats };
    } catch (error) {
      log.error('Error getting dictionary stats:', error);
      throw error;
    }
  });
}
