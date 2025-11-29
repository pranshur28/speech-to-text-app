const { app, BrowserWindow, Menu, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const { TranscriptionService } = require('./services/transcription');
const { TextFormatter } = require('./services/formatter');
const { PasteService } = require('./services/paste');
require('dotenv').config();

let isRecording = false;

let mainWindow: any = null;
let transcriptionService: any = null;
let textFormatter: any = null;
let pasteService: any = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
  });

  // Don't show in dock on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  transcriptionService = new TranscriptionService(process.env.OPENAI_API_KEY || '');
  textFormatter = new TextFormatter(process.env.OPENAI_API_KEY || '');
  pasteService = new PasteService();

  createWindow();
  createMenu();

  // Register global shortcut for recording toggle
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Ctrl+Shift+Space';

  globalShortcut.register(shortcut, () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-recording');
    }
  });

  console.log(`Global shortcut registered: ${shortcut}`);
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const createMenu = () => {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// IPC Handlers
ipcMain.handle('transcribe-audio', async (_event: any, audioBuffer: ArrayBuffer) => {
  if (!transcriptionService) throw new Error('Transcription service not initialized');
  try {
    const transcript = await transcriptionService.transcribe(Buffer.from(audioBuffer));
    return { success: true, transcript };
  } catch (error) {
    console.error('Error transcribing:', error);
    throw error;
  }
});

ipcMain.handle('format-text', async (_event: any, text: string) => {
  if (!textFormatter) throw new Error('Text formatter not initialized');
  try {
    const formatted = await textFormatter.format(text);
    return { success: true, formatted };
  } catch (error) {
    console.error('Error formatting:', error);
    throw error;
  }
});

ipcMain.handle('paste-text', async (_event: any, text: string) => {
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

