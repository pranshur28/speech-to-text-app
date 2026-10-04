import { BrowserWindow, ipcMain, IpcMainEvent, screen } from 'electron';
import log from '../utils/logger';
import { ServiceContext } from './types';
import type { OverlayState } from '../preload';

// Room for the ripples at full size and the fan of control cards above the dot
export const OVERLAY_WIDTH = 200;
export const OVERLAY_HEIGHT = 130;
// Dot centre above the window bottom; matches --dot-bottom + --dot / 2 in overlay.css
const DOT_FROM_BOTTOM = 34;
// Gap between the top of the taskbar and the centre of the dot
const DOT_GAP = 8;
// How often to check the cursor while the controls are open
const POINTER_POLL_MS = 100;
// Matches the pill's exit animation in overlay.css, so it can finish before the window hides
const HIDE_DELAY_MS = 180;

/**
 * Bottom-center of the work area on the monitor the mouse is on (respects taskbar position).
 * The transparent, click-through window may hang over the taskbar so the dot itself can sit low.
 */
export function positionOverlayWindow(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  win.setBounds({
    x: Math.round(x + width / 2 - OVERLAY_WIDTH / 2),
    y: Math.round(y + height - DOT_GAP + DOT_FROM_BOTTOM - OVERLAY_HEIGHT),
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  });
}

export function registerOverlayHandlers(ctx: ServiceContext) {
  let hideTimer: NodeJS.Timeout | null = null;
  let visible = false;
  let lastState: OverlayState = { phase: 'hidden', holdMode: false };
  let pointerTimer: NodeJS.Timeout | null = null;

  const stopPointerWatch = () => {
    if (pointerTimer) {
      clearInterval(pointerTimer);
      pointerTimer = null;
    }
  };

  // The window hangs over the taskbar, which sits above it, so the page doesn't always see the
  // mouse leave. While the controls are open, close them once the cursor leaves the window or
  // drops onto the taskbar.
  const startPointerWatch = (win: BrowserWindow) => {
    stopPointerWatch();
    pointerTimer = setInterval(() => {
      if (win.isDestroyed()) {
        stopPointerWatch();
        return;
      }
      const cursor = screen.getCursorScreenPoint();
      const bounds = win.getBounds();
      const workArea = screen.getDisplayMatching(bounds).workArea;
      const inside =
        cursor.x >= bounds.x &&
        cursor.x < bounds.x + bounds.width &&
        cursor.y >= Math.max(bounds.y, workArea.y) &&
        cursor.y < Math.min(bounds.y + bounds.height, workArea.y + workArea.height);
      if (!inside) {
        stopPointerWatch();
        win.setIgnoreMouseEvents(true, { forward: true });
        win.webContents.send('overlay:pointer-left');
      }
    }, POINTER_POLL_MS);
  };

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
      stopPointerWatch();
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
      // Windows drops the topmost level of a hidden, non-focusable window, so reassert it on every show
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      overlayWindow.moveTop();
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
        startPointerWatch(overlayWindow);
      } else {
        stopPointerWatch();
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });
}
