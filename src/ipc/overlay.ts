import { BrowserWindow, ipcMain, IpcMainEvent, screen } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';
import type { OverlayState } from '../preload';

// Room for the fully expanded pill (~180px) plus its halo and shadow on every side
export const OVERLAY_WIDTH = 330;
export const OVERLAY_HEIGHT = 90;
// Matches the pill's exit animation in overlay.css, so it can finish before the window hides
const HIDE_DELAY_MS = 180;

/** Bottom-center of the work area on the monitor the mouse is on (respects taskbar position). */
export function positionOverlayWindow(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  win.setBounds({
    x: Math.round(x + width / 2 - OVERLAY_WIDTH / 2),
    y: Math.round(y + height - OVERLAY_HEIGHT - 6),
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  });
}

export function registerOverlayHandlers(ctx: ServiceContext) {
  let hideTimer: NodeJS.Timeout | null = null;
  let visible = false;
  let lastState: OverlayState = { phase: 'hidden', holdMode: false };

  // A (re)loaded overlay page asks for the current state, in case it missed it while loading
  ipcMain.on('overlay:ready', (event: IpcMainEvent) => {
    event.sender.send('overlay:state', lastState);
  });

  // The main window owns recording state; the overlay just mirrors it
  ipcMain.on('overlay:set-state', (_event: IpcMainEvent, state: OverlayState) => {
    lastState = state;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (state.phase === 'hidden') {
      const overlayWindow = ctx.getOverlayWindow();
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      overlayWindow.webContents.send('overlay:state', state);
      visible = false;
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!overlayWindow.isDestroyed()) {
          overlayWindow.setIgnoreMouseEvents(true, { forward: true });
          overlayWindow.hide();
        }
      }, HIDE_DELAY_MS);
      return;
    }

    let overlayWindow = ctx.getOverlayWindow();
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      ctx.createOverlayWindow();
      overlayWindow = ctx.getOverlayWindow();
    }
    if (!overlayWindow) return;

    if (!visible) {
      positionOverlayWindow(overlayWindow);
      visible = true;
    }
    overlayWindow.webContents.send('overlay:state', state);
    if (!overlayWindow.isVisible()) {
      overlayWindow.showInactive();
    }
  });

  ipcMain.on('audio-data', (_event: IpcMainEvent, data: any) => {
    const overlayWindow = ctx.getOverlayWindow();
    if (overlayWindow && !overlayWindow.isDestroyed() && visible) {
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
