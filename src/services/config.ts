import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import log from '../utils/logger';

interface Config {
  openaiApiKey?: string;
  deepgramApiKey?: string;
  toggleShortcut?: string;
  holdShortcut?: string;
  overlayPosition?: { centerX: number; centerY: number };
}

export class ConfigService {
  private configPath: string;
  private config: Config;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this.load();
  }

  private load(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      log.error('Error loading config:', error);
    }
    return {};
  }

  private save(): void {
    try {
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      log.error('Error saving config:', error);
    }
  }

  getApiKey(): string | undefined {
    // First check config file, then fall back to .env
    return this.config.openaiApiKey || process.env.OPENAI_API_KEY;
  }

  setApiKey(apiKey: string): void {
    this.config.openaiApiKey = apiKey;
    this.save();
  }

  hasApiKey(): boolean {
    const key = this.getApiKey();
    return !!key && key.startsWith('sk-');
  }

  getDefaultToggleShortcut(platform: string = process.platform): string {
    return platform === 'darwin' ? 'Command+Shift+Space' : 'Ctrl+Shift+Space';
  }

  getToggleShortcut(): string {
    return this.config.toggleShortcut || this.getDefaultToggleShortcut();
  }

  getHoldShortcut(): string {
    return this.config.holdShortcut || '';
  }

  setToggleShortcut(shortcut: string): void {
    this.config.toggleShortcut = shortcut;
    this.save();
  }

  setHoldShortcut(shortcut: string): void {
    this.config.holdShortcut = shortcut;
    this.save();
  }

  getDeepgramApiKey(): string | undefined {
    return this.config.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
  }

  setDeepgramApiKey(key: string): void {
    this.config.deepgramApiKey = key;
    this.save();
  }

  getOverlayPosition(): { centerX: number; centerY: number } | undefined {
    const pos = this.config.overlayPosition as any;
    if (!pos) return undefined;
    if (Number.isFinite(pos.centerX) && Number.isFinite(pos.centerY)) {
      return { centerX: pos.centerX, centerY: pos.centerY };
    }
    // Migrate legacy {x, y} top-left format saved by older builds (idle size 48x48)
    if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      return { centerX: pos.x + 24, centerY: pos.y + 24 };
    }
    return undefined;
  }

  setOverlayPosition(centerX: number, centerY: number): void {
    this.config.overlayPosition = { centerX, centerY };
    this.save();
  }
}
