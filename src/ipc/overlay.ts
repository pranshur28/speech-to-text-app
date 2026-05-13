import { ipcMain, IpcMainEvent } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';

type OverlayState = 'idle' | 'recording' | 'paused';
const VALID_OVERLAY_STATES = new Set<string>(['idle', 'recording', 'paused']);
const VALID_OVERLAY_ACTIONS = new Set<string>(['stop', 'pause', 'resume']);
const MAX_COORD = 32767; // sanity cap for window coordinates

function isFiniteCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;
}

export function registerOverlayHandlers(ctx: ServiceContext) {
  ipcMain.on('set-overlay-state', (_event: IpcMainEvent, state: unknown) => {
    if (typeof state !== 'string' || !VALID_OVERLAY_STATES.has(state)) return;
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

  ipcMain.on('overlay-action', (_event: IpcMainEvent, action: unknown) => {
    if (typeof action !== 'string' || !VALID_OVERLAY_ACTIONS.has(action)) return;
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

  ipcMain.on('move-overlay-window', (_event: IpcMainEvent, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return;
    const { x, y } = payload as any;
    if (!isFiniteCoord(x) || !isFiniteCoord(y)) return;
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setPosition(Math.round(x), Math.round(y));
    }
  });

  ipcMain.on('save-overlay-position', (_event: IpcMainEvent, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return;
    const { x, y } = payload as any;
    if (!isFiniteCoord(x) || !isFiniteCoord(y)) return;
    const configService = ctx.getConfigService();
    const overlayWindow = ctx.getOverlayWindow();
    if (configService && overlayWindow && !overlayWindow.isDestroyed()) {
      // Convert top-left to center so the position model is size-independent.
      // Restoring from center avoids drift when the window starts at a different
      // size than it was when the position was saved.
      const [w, h] = overlayWindow.getSize();
      configService.setOverlayPosition(x + w / 2, y + h / 2);
    }
  });

  ipcMain.on('resize-overlay-window', (_event: IpcMainEvent, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return;
    const { width, height } = payload as any;
    if (
      typeof width !== 'number' || typeof height !== 'number' ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      width < 1 || height < 1 || width > 4096 || height > 4096
    ) return;
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      const [currentW, currentH] = overlayWindow.getSize();
      // Keep the visual center fixed so the pill doesn't jump when the window
      // expands from idle (48x48) to recording (240x65) or vice versa.
      const newX = Math.round(x + (currentW - width) / 2);
      const newY = Math.round(y + (currentH - height) / 2);
      overlayWindow.setBounds({ x: newX, y: newY, width, height });
    }
  });
}
