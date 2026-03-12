import { app, BrowserWindow, Menu, Tray, nativeImage, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { TranscriptionService } from './services/transcription';
import { TextFormatter } from './services/formatter';
import { PasteService } from './services/paste';
import { ConfigService } from './services/config';
import { DatabaseService } from './services/database';
import { SearchService } from './services/search';
import { DictionaryService } from './services/dictionary';
import { DeepgramStreamingService } from './services/deepgram';
import { ShortcutManager } from './shortcuts/shortcut-manager';
import { ServiceContext } from './ipc/types';
import { registerApiKeyHandlers } from './ipc/api-keys';
import { registerShortcutHandlers } from './ipc/shortcuts';
import { registerAudioTranscriptionHandlers } from './ipc/audio-transcription';
import { registerOverlayHandlers } from './ipc/overlay';
import { registerDatabaseHandlers } from './ipc/database';
import { registerDictionaryHandlers } from './ipc/dictionary';
import { registerDeepgramHandlers } from './ipc/deepgram';
import log from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

// Service declarations
let configService: ConfigService;
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let transcriptionService: TranscriptionService | null = null;
let textFormatter: TextFormatter | null = null;
let pasteService: PasteService | null = null;
let databaseService: DatabaseService | null = null;
let searchService: SearchService | null = null;
let dictionaryService: DictionaryService | null = null;
let deepgramService: DeepgramStreamingService | null = null;
let shortcutManager: ShortcutManager;

// Track app quitting state
let isAppQuitting = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    alwaysOnTop: false,
    frame: true,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    hasShadow: true,
    show: false,
  });

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
    width: 240,
    height: 65,
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
    x: 0,
    y: 0
  });

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  overlayWindow.setPosition(Math.round(width / 2 - 120), height - 80);

  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173/#/overlay'
    : `file://${path.join(__dirname, '../build/index.html')}#/overlay`;

  overlayWindow.loadURL(startUrl);
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
};

const createTray = () => {
  const iconPath = path.join(__dirname, '../assets/icon.png');
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
    log.info("Could not create tray icon (assets might be missing):", e);
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

  const apiKey = configService.getApiKey() || '';
  if (!apiKey) {
    log.warn('No API key configured. Please add your API key in Settings.');
  } else if (!apiKey.startsWith('sk-')) {
    log.warn('Invalid API key format. API keys should start with "sk-".');
  }

  // Initialize services
  transcriptionService = new TranscriptionService(apiKey);
  textFormatter = new TextFormatter(apiKey);
  pasteService = new PasteService();
  databaseService = new DatabaseService();
  searchService = new SearchService(databaseService);
  dictionaryService = new DictionaryService(databaseService.getDb());

  // Initialize shortcut manager
  shortcutManager = new ShortcutManager(() => mainWindow);
  shortcutManager.setToggleShortcut(configService.getToggleShortcut());
  shortcutManager.setHoldShortcut(configService.getHoldShortcut());

  // Build service context
  const ctx: ServiceContext = {
    getMainWindow: () => mainWindow,
    getOverlayWindow: () => overlayWindow,
    getConfigService: () => configService,
    getTranscriptionService: () => transcriptionService,
    getTextFormatter: () => textFormatter,
    getPasteService: () => pasteService,
    getDatabaseService: () => databaseService,
    getSearchService: () => searchService,
    getDictionaryService: () => dictionaryService,
    getDeepgramService: () => deepgramService,
    setDeepgramService: (svc) => { deepgramService = svc; },
    setTranscriptionService: (svc) => { transcriptionService = svc; },
    setTextFormatter: (svc) => { textFormatter = svc; },
    getShortcutManager: () => shortcutManager,
    createOverlayWindow,
  };

  // Register all IPC handlers
  registerApiKeyHandlers(ctx);
  registerShortcutHandlers(ctx);
  registerAudioTranscriptionHandlers(ctx);
  registerOverlayHandlers(ctx);
  registerDatabaseHandlers(ctx);
  registerDictionaryHandlers(ctx);
  registerDeepgramHandlers(ctx);

  createWindow();
  createOverlayWindow();
  createMenu();
  createTray();

  // Register global shortcuts
  shortcutManager.refresh();
});

app.on('will-quit', () => {
  if (deepgramService) {
    deepgramService.stopSession().catch(() => {});
    deepgramService = null;
  }

  if (databaseService) {
    databaseService.close();
  }

  shortcutManager?.stop();
});

app.on('window-all-closed', () => {
  // Do not quit when all windows are closed (keep running in background)
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
