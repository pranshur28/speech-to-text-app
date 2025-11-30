import { app, BrowserWindow, Menu, ipcMain, dialog, Tray, nativeImage, MenuItemConstructorOptions, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import path from 'path';
import { TranscriptionService } from './services/transcription';
import { TextFormatter } from './services/formatter';
import { PasteService } from './services/paste';
import { ConfigService } from './services/config';
import { DatabaseService, TranscriptionInsert } from './services/database';
import { SearchService } from './services/search';
import dotenv from 'dotenv';

dotenv.config();

// Initialize config service early
let configService: ConfigService;

// Track app quitting state
let isAppQuitting = false;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let transcriptionService: TranscriptionService | null = null;
let textFormatter: TextFormatter | null = null;
let pasteService: PasteService | null = null;
let databaseService: DatabaseService | null = null;
let searchService: SearchService | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Prevent throttling when window is hidden - critical for background operation
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    alwaysOnTop: false,
    frame: true,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    hasShadow: true,
    show: false, // Don't show until ready-to-show
  });

  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close (minimize to tray instead of quit)
  mainWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createOverlayWindow = () => {
  overlayWindow = new BrowserWindow({
    width: 200,
    height: 60,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    focusable: false, // Click-through-ish behavior (doesn't steal focus)
    x: 0, // Will position later or let OS decide, but usually top-center is good
    y: 0
  });

  // Position at bottom center
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  overlayWindow.setPosition(Math.round(width / 2 - 100), height - 100);

  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173/#/overlay'
    : `file://${path.join(__dirname, '../build/index.html')}#/overlay`;

  overlayWindow.loadURL(startUrl);

  // Make it ignore mouse events so it's click-through
  overlayWindow.setIgnoreMouseEvents(true);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
};

const createTray = () => {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  // In a real app, you'd want a proper tray icon. For now, we'll use the app icon if it exists, 
  // or a native image if not. Since we don't have assets yet, let's use an empty image or handle error.
  // For this environment, let's try to be safe.

  try {
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => mainWindow?.show() },
      { type: 'separator' },
      {
        label: 'Quit', click: () => {
          isAppQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Speech to Text App');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
      }
    });
  } catch (e) {
    console.log("Could not create tray icon (assets might be missing):", e);
  }
};

const createMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.hide();
          }
        },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isAppQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

app.on('ready', () => {
  // Initialize config service
  configService = new ConfigService();

  // Load shortcuts from config (or use platform-specific defaults)
  toggleShortcut = configService.getToggleShortcut();
  holdShortcut = configService.getHoldShortcut();

  const apiKey = configService.getApiKey() || '';

  // Don't show error dialog on startup - let user configure in settings
  // Just log a warning if no API key is found
  if (!apiKey) {
    console.warn('No API key configured. Please add your API key in Settings.');
  } else if (!apiKey.startsWith('sk-')) {
    console.warn('Invalid API key format. API keys should start with "sk-".');
  }

  // Initialize services
  transcriptionService = new TranscriptionService(apiKey);
  textFormatter = new TextFormatter(apiKey);
  pasteService = new PasteService();

  // Initialize database and search services
  databaseService = new DatabaseService();
  searchService = new SearchService(databaseService);

  createWindow();
  createOverlayWindow();
  createMenu();
  createTray();

  // Register global shortcuts
  refreshShortcuts();
});

// IPC handler to check API key status
ipcMain.handle('get-api-key-status', () => {
  if (!configService) {
    return { valid: false, error: 'Config service not initialized' };
  }
  const apiKey = configService.getApiKey() || '';
  if (!apiKey) {
    return { valid: false, error: 'API key not configured' };
  }
  if (!apiKey.startsWith('sk-')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  return { valid: true, error: null };
});

// IPC handler to get API key
ipcMain.handle('get-api-key', () => {
  if (!configService) return '';
  return configService.getApiKey() || '';
});

// IPC handler to save API key
ipcMain.handle('save-api-key', (_event: IpcMainInvokeEvent, apiKey: string) => {
  if (!configService) {
    return { success: false, error: 'Config service not initialized' };
  }

  // Validate API key format
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return { success: false, error: 'Invalid API key format. Key should start with "sk-"' };
  }

  // Save the API key
  configService.setApiKey(apiKey);

  // Reinitialize services with new API key
  transcriptionService = new TranscriptionService(apiKey);
  textFormatter = new TextFormatter(apiKey);

  return { success: true, error: null };
});

// Dual shortcut state (loaded from config on startup)
let toggleShortcut = '';
let holdShortcut = '';
let isTogglePressed = false;
let isHoldPressed = false;

// Track currently pressed keys
const pressedKeys = new Set<number>();

// Parse shortcut string to required modifiers and key
function parseShortcutToKeyCodes(shortcut: string): {
  requiresMeta: boolean,
  requiresCtrl: boolean,
  requiresAlt: boolean,
  requiresShift: boolean,
  key: number | null
} {
  const parts = shortcut.split('+').map(p => p.trim());
  let requiresMeta = false;
  let requiresCtrl = false;
  let requiresAlt = false;
  let requiresShift = false;
  let key: number | null = null;

  console.log(`[DEBUG] Parsing shortcut: "${shortcut}" → parts:`, parts);

  for (const part of parts) {
    const upperPart = part.toUpperCase();
    switch (upperPart) {
      case 'COMMAND':
      case 'CMD':
        requiresMeta = true;
        break;
      case 'CTRL':
      case 'CONTROL':
        requiresCtrl = true;
        break;
      case 'ALT':
        requiresAlt = true;
        break;
      case 'SHIFT':
        requiresShift = true;
        break;
      // Special keys
      case 'SPACE':
        key = UiohookKey.Space;
        break;
      case 'RETURN':
      case 'ENTER':
        key = UiohookKey.Enter;
        break;
      case 'ESCAPE':
      case 'ESC':
        key = UiohookKey.Escape;
        break;
      case 'BACKSPACE':
        key = UiohookKey.Backspace;
        break;
      case 'DELETE':
        key = UiohookKey.Delete;
        break;
      case 'TAB':
        key = UiohookKey.Tab;
        break;
      case 'CAPSLOCK':
        key = UiohookKey.CapsLock;
        break;
      case 'NUMLOCK':
        key = UiohookKey.NumLock;
        break;
      case 'SCROLLLOCK':
        key = UiohookKey.ScrollLock;
        break;
      // Note: Pause key not available in uiohook-napi
      case 'INSERT':
        key = UiohookKey.Insert;
        break;
      case 'HOME':
        key = UiohookKey.Home;
        break;
      case 'PAGEUP':
        key = UiohookKey.PageUp;
        break;
      case 'PAGEDOWN':
        key = UiohookKey.PageDown;
        break;
      case 'END':
        key = UiohookKey.End;
        break;
      case 'PRINTSCREEN':
      case 'PRINT':
        key = UiohookKey.PrintScreen;
        break;
      // Arrow keys
      case 'UP':
      case 'ARROWUP':
        key = UiohookKey.ArrowUp;
        break;
      case 'DOWN':
      case 'ARROWDOWN':
        key = UiohookKey.ArrowDown;
        break;
      case 'LEFT':
      case 'ARROWLEFT':
        key = UiohookKey.ArrowLeft;
        break;
      case 'RIGHT':
      case 'ARROWRIGHT':
        key = UiohookKey.ArrowRight;
        break;
      default:
        // Function keys (F1-F24)
        if (/^F(\d+)$/.test(upperPart)) {
          const fNum = parseInt(upperPart.substring(1));
          const keyCode = (UiohookKey as any)[`F${fNum}`];
          if (keyCode !== undefined) {
            key = keyCode;
          }
        }
        // Number keys (0-9)
        else if (/^[0-9]$/.test(part)) {
          const keyCode = (UiohookKey as any)[`Digit${part}`];
          if (keyCode !== undefined) {
            key = keyCode;
          }
        }
        // Single letter keys (A-Z)
        else if (/^[A-Z]$/i.test(part)) {
          const char = part.toUpperCase();
          const keyCode = (UiohookKey as any)[char];
          if (keyCode !== undefined) {
            key = keyCode;
          } else {
            console.warn(`[DEBUG] Could not find keycode for letter: ${char}`);
          }
        }
        // Any other single character
        else if (part.length === 1) {
          console.warn(`[DEBUG] Unrecognized single character key: "${part}"`);
        }
        break;
    }
  }

  console.log(`[DEBUG] Parsed result:`, { requiresMeta, requiresCtrl, requiresAlt, requiresShift, key, keyName: key ? Object.keys(UiohookKey).find(k => (UiohookKey as any)[k] === key) : null });
  return { requiresMeta, requiresCtrl, requiresAlt, requiresShift, key };
}

// Check if required modifiers are currently pressed
function checkModifiers(shortcutKeys: ReturnType<typeof parseShortcutToKeyCodes>): boolean {
  const metaPressed = pressedKeys.has(UiohookKey.Meta) ||
                      pressedKeys.has(UiohookKey.MetaRight);
  const ctrlPressed = pressedKeys.has(UiohookKey.Ctrl) ||
                      pressedKeys.has(UiohookKey.CtrlRight);
  const altPressed = pressedKeys.has(UiohookKey.Alt) ||
                     pressedKeys.has(UiohookKey.AltRight);
  const shiftPressed = pressedKeys.has(UiohookKey.Shift) ||
                       pressedKeys.has(UiohookKey.ShiftRight);

  return (shortcutKeys.requiresMeta === metaPressed) &&
         (shortcutKeys.requiresCtrl === ctrlPressed) &&
         (shortcutKeys.requiresAlt === altPressed) &&
         (shortcutKeys.requiresShift === shiftPressed);
}

function refreshShortcuts() {
  console.log(`[DEBUG] Refreshing shortcuts. Toggle: "${toggleShortcut}", Hold: "${holdShortcut}"`);

  try {
    uIOhook.stop();
  } catch (e) { }

  const toggleKeys = toggleShortcut ? parseShortcutToKeyCodes(toggleShortcut) : null;
  const holdKeys = holdShortcut ? parseShortcutToKeyCodes(holdShortcut) : null;

  uIOhook.removeAllListeners('keydown');
  uIOhook.removeAllListeners('keyup');

  uIOhook.on('keydown', (e: any) => {
    // Track pressed keys
    pressedKeys.add(e.keycode);

    // Debug: Log key presses with current modifiers
    const currentMods = {
      meta: pressedKeys.has(UiohookKey.Meta) || pressedKeys.has(UiohookKey.MetaRight),
      ctrl: pressedKeys.has(UiohookKey.Ctrl) || pressedKeys.has(UiohookKey.CtrlRight),
      alt: pressedKeys.has(UiohookKey.Alt) || pressedKeys.has(UiohookKey.AltRight),
      shift: pressedKeys.has(UiohookKey.Shift) || pressedKeys.has(UiohookKey.ShiftRight),
    };

    // Check Toggle Shortcut
    if (toggleKeys && toggleKeys.key !== null && e.keycode === toggleKeys.key) {
      console.log(`[DEBUG] Toggle key matched! keycode=${e.keycode}, checkModifiers=${checkModifiers(toggleKeys)}, currentMods:`, currentMods, 'required:', { meta: toggleKeys.requiresMeta, ctrl: toggleKeys.requiresCtrl, alt: toggleKeys.requiresAlt, shift: toggleKeys.requiresShift });
      if (!isTogglePressed && checkModifiers(toggleKeys)) {
        isTogglePressed = true;
        console.log('[DEBUG] Toggle shortcut triggered');
        if (mainWindow) mainWindow.webContents.send('toggle-recording');
      }
    }

    // Check Hold Shortcut
    if (holdKeys && holdKeys.key !== null && e.keycode === holdKeys.key) {
      console.log(`[DEBUG] Hold key matched! keycode=${e.keycode}, checkModifiers=${checkModifiers(holdKeys)}, currentMods:`, currentMods, 'required:', { meta: holdKeys.requiresMeta, ctrl: holdKeys.requiresCtrl, alt: holdKeys.requiresAlt, shift: holdKeys.requiresShift });
      if (!isHoldPressed && checkModifiers(holdKeys)) {
        isHoldPressed = true;
        console.log('[DEBUG] Hold shortcut pressed - starting recording');
        if (mainWindow) mainWindow.webContents.send('start-recording');
      }
    }
  });

  uIOhook.on('keyup', (e: any) => {
    // Track released keys
    pressedKeys.delete(e.keycode);

    // Check Toggle Shortcut Release
    if (toggleKeys && toggleKeys.key !== null && e.keycode === toggleKeys.key) {
      isTogglePressed = false;
    }

    // Check Hold Shortcut Release
    if (holdKeys && holdKeys.key !== null && e.keycode === holdKeys.key) {
      if (isHoldPressed) {
        isHoldPressed = false;
        console.log('[DEBUG] Hold shortcut released - stopping recording');
        if (mainWindow) mainWindow.webContents.send('stop-recording');
      }
    }
  });

  try {
    uIOhook.start();
  } catch (error) {
    console.error('[DEBUG] Failed to start uIOhook', error);
  }
}





// New IPC to control overlay from renderer
ipcMain.on('set-overlay-visible', (_event: IpcMainEvent, visible: boolean) => {
  if (overlayWindow) {
    if (visible) {
      overlayWindow.showInactive(); // Show without stealing focus
    } else {
      overlayWindow.hide();
    }
  }
});

// Forward audio data from main app to overlay
ipcMain.on('audio-data', (_event: IpcMainEvent, data: any) => {
  console.log('[MAIN] Forwarding audio data to overlay, overlay exists:', !!overlayWindow, 'destroyed:', overlayWindow?.isDestroyed());
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('audio-data', data);
  }
});

ipcMain.handle('update-global-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
  console.log(`[DEBUG] Received request to update shortcut to: "${shortcut}"`);
  // Legacy handler: assume it updates toggle shortcut
  toggleShortcut = shortcut;
  refreshShortcuts();
  return {
    success: true,
    shortcut: shortcut,
    error: undefined
  };
});

app.on('will-quit', () => {
  // Close database (automatically backs up)
  if (databaseService) {
    databaseService.close();
  }

  // Stop uiohook
  try {
    uIOhook.stop();
  } catch (e) {
    console.log('Error stopping uiohook:', e);
  }
});

app.on('window-all-closed', () => {
  // Do not quit when all windows are closed (keep running in background)
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});



// IPC Handlers
ipcMain.handle('transcribe-audio', async (_event: IpcMainInvokeEvent, audioBuffer: ArrayBuffer) => {
  if (!transcriptionService) throw new Error('Transcription service not initialized');
  try {
    const transcript = await transcriptionService.transcribe(Buffer.from(audioBuffer));
    return { success: true, transcript };
  } catch (error) {
    console.error('Error transcribing:', error);
    throw error;
  }
});

ipcMain.handle('format-text', async (_event: IpcMainInvokeEvent, text: string) => {
  if (!textFormatter) throw new Error('Text formatter not initialized');
  try {
    const formatted = await textFormatter.format(text);
    return { success: true, formatted };
  } catch (error) {
    console.error('Error formatting:', error);
    throw error;
  }
});

ipcMain.handle('paste-text', async (_event: IpcMainInvokeEvent, text: string) => {
  if (!pasteService) throw new Error('Paste service not initialized');
  try {
    await pasteService.paste(text);
    return { success: true };
  } catch (error) {
    console.error('Error pasting:', error);
    throw error;
  }
});

ipcMain.handle('select-audio-file', async () => {
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
    console.error('Error selecting file:', error);
    throw error;
  }
});

ipcMain.handle('get-shortcuts', () => {
  return { toggle: toggleShortcut, hold: holdShortcut };
});

ipcMain.handle('get-global-shortcut', () => {
  return toggleShortcut;
});

ipcMain.handle('set-toggle-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
  console.log(`[DEBUG] Setting toggle shortcut to: ${shortcut}`);
  toggleShortcut = shortcut;
  configService.setToggleShortcut(shortcut);
  refreshShortcuts();
  return { success: true };
});

ipcMain.handle('set-hold-shortcut', (_event: IpcMainInvokeEvent, shortcut: string) => {
  console.log(`[DEBUG] Setting hold shortcut to: ${shortcut}`);
  holdShortcut = shortcut;
  configService.setHoldShortcut(shortcut);
  refreshShortcuts();
  return { success: true };
});

// Database IPC Handlers

ipcMain.handle('db:save-transcription', (_event: IpcMainInvokeEvent, data: TranscriptionInsert) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    const id = databaseService.saveTranscription(data);
    return { success: true, id };
  } catch (error) {
    console.error('Error saving transcription:', error);
    throw error;
  }
});

ipcMain.handle('db:get-transcription', (_event: IpcMainInvokeEvent, id: number) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    const transcription = databaseService.getTranscription(id);
    return { success: true, transcription };
  } catch (error) {
    console.error('Error getting transcription:', error);
    throw error;
  }
});

ipcMain.handle('db:get-transcriptions', (_event: IpcMainInvokeEvent, filters?: any) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    const transcriptions = databaseService.getTranscriptions(filters || {});
    return { success: true, transcriptions };
  } catch (error) {
    console.error('Error getting transcriptions:', error);
    throw error;
  }
});

ipcMain.handle('db:search', (_event: IpcMainInvokeEvent, query: string, filters?: any) => {
  if (!searchService) throw new Error('Search service not initialized');
  try {
    const result = searchService.search({ query, filters });
    return { success: true, ...result };
  } catch (error) {
    console.error('Error searching transcriptions:', error);
    throw error;
  }
});

ipcMain.handle('db:update-transcription', (_event: IpcMainInvokeEvent, id: number, updates: any) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    databaseService.updateTranscription(id, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating transcription:', error);
    throw error;
  }
});

ipcMain.handle('db:delete-transcription', (_event: IpcMainInvokeEvent, id: number) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    databaseService.deleteTranscription(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting transcription:', error);
    throw error;
  }
});

ipcMain.handle('db:toggle-favorite', (_event: IpcMainInvokeEvent, id: number) => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    databaseService.toggleFavorite(id);
    return { success: true };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
});

ipcMain.handle('db:export', (_event: IpcMainInvokeEvent, ids: number[], format: 'json' | 'markdown' | 'txt') => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    const data = databaseService.exportTranscriptions(ids, format);
    return { success: true, data };
  } catch (error) {
    console.error('Error exporting transcriptions:', error);
    throw error;
  }
});

ipcMain.handle('db:get-stats', () => {
  if (!databaseService) throw new Error('Database service not initialized');
  try {
    const stats = databaseService.getStats();
    return { success: true, stats };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
});
