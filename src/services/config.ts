import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import log from '../utils/logger';

export type SttEngine = 'flux' | 'nova-3';

interface Config {
  deepgramApiKey?: string;
  sttEngine?: SttEngine;
  liveTyping?: boolean;
  toggleShortcut?: string;
  holdShortcut?: string;
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

  getSttEngine(): SttEngine {
    return this.config.sttEngine === 'nova-3' ? 'nova-3' : 'flux';
  }

  setSttEngine(engine: SttEngine): void {
    this.config.sttEngine = engine;
    this.save();
  }

  /** Type words as they're heard (default) vs. paste each phrase once it's confirmed. */
  getLiveTyping(): boolean {
    return this.config.liveTyping !== false;
  }

  setLiveTyping(enabled: boolean): void {
    this.config.liveTyping = enabled;
    this.save();
  }
}
