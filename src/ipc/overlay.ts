import { ipcMain, IpcMainEvent } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';

export function registerOverlayHandlers(ctx: ServiceContext) {
  ipcMain.on('set-overlay-visible', (_event: IpcMainEvent, visible: boolean) => {
    if (visible) {
      const overlayWindow = ctx.getOverlayWindow();
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        ctx.createOverlayWindow();
      }
      ctx.getOverlayWindow()?.showInactive();
    } else {
      const overlayWindow = ctx.getOverlayWindow();
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    }
  });

  ipcMain.on('audio-data', (_event: IpcMainEvent, data: any) => {
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('audio-data', data);
    }
  });

  ipcMain.on('overlay-action', (_event: IpcMainEvent, action: 'stop' | 'pause' | 'resume') => {
    log.debug('Received overlay action:', action);
    const mainWindow = ctx.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (action === 'stop') {
        mainWindow.webContents.send('stop-recording');
      } else if (action === 'pause') {
        mainWindow.webContents.send('pause-recording');
      } else if (action === 'resume') {
        mainWindow.webContents.send('resume-recording');
      }
    }
  });

  ipcMain.on('set-overlay-interactive', (_event: IpcMainEvent, interactive: boolean) => {
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (interactive) {
        overlayWindow.setIgnoreMouseEvents(false);
      } else {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });
}
