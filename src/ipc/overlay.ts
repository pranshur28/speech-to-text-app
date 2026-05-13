import { ipcMain, IpcMainEvent } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';

type OverlayState = 'idle' | 'recording' | 'paused';

export function registerOverlayHandlers(ctx: ServiceContext) {
  ipcMain.on('set-overlay-state', (_event: IpcMainEvent, state: OverlayState) => {
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('overlay-state', state);
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

  ipcMain.on('move-overlay-window', (_event: IpcMainEvent, { x, y }: { x: number; y: number }) => {
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setPosition(Math.round(x), Math.round(y));
    }
  });

  ipcMain.on('save-overlay-position', (_event: IpcMainEvent, { x, y }: { x: number; y: number }) => {
    const configService = ctx.getConfigService();
    if (configService) {
      configService.setOverlayPosition(x, y);
    }
  });
}
