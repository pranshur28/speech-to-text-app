import { ipcMain, IpcMainInvokeEvent } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerShortcutHandlers(ctx: ServiceContext) {
  ipcMain.handle('get-shortcuts', () => {
    const mgr = ctx.getShortcutManager();
    return { toggle: mgr.getToggleShortcut(), hold: mgr.getHoldShortcut() };
  });

  ipcMain.handle('get-global-shortcut', () => {
    return ctx.getShortcutManager().getToggleShortcut();
  });

  ipcMain.handle('set-toggle-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
    log.debug(`Setting toggle shortcut to: ${shortcut}`);
    const mgr = ctx.getShortcutManager();
    mgr.setToggleShortcut(shortcut);
    ctx.getConfigService().setToggleShortcut(shortcut);
    mgr.refresh();
    return { success: true };
  });

  ipcMain.handle('set-hold-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
    log.debug(`Setting hold shortcut to: ${shortcut}`);
    const mgr = ctx.getShortcutManager();
    mgr.setHoldShortcut(shortcut);
    ctx.getConfigService().setHoldShortcut(shortcut);
    mgr.refresh();
    return { success: true };
  });

  ipcMain.handle('update-global-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
    log.debug(`Received request to update shortcut to: "${shortcut}"`);
    const mgr = ctx.getShortcutManager();
    mgr.setToggleShortcut(shortcut);
    mgr.refresh();
    return { success: true, shortcut, error: undefined };
  });
}
