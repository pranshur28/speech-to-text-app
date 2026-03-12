import { BrowserWindow } from 'electron';
import { TranscriptionService } from '../services/transcription';
import { TextFormatter } from '../services/formatter';
import { PasteService } from '../services/paste';
import { ConfigService } from '../services/config';
import { DatabaseService } from '../services/database';
import { SearchService } from '../services/search';
import { DictionaryService } from '../services/dictionary';
import { DeepgramStreamingService } from '../services/deepgram';
import { ShortcutManager } from '../shortcuts/shortcut-manager';

export interface ServiceContext {
  getMainWindow: () => BrowserWindow | null;
  getOverlayWindow: () => BrowserWindow | null;
  getConfigService: () => ConfigService;
  getTranscriptionService: () => TranscriptionService | null;
  getTextFormatter: () => TextFormatter | null;
  getPasteService: () => PasteService | null;
  getDatabaseService: () => DatabaseService | null;
  getSearchService: () => SearchService | null;
  getDictionaryService: () => DictionaryService | null;
  getDeepgramService: () => DeepgramStreamingService | null;
  setDeepgramService: (svc: DeepgramStreamingService | null) => void;
  setTranscriptionService: (svc: TranscriptionService) => void;
  setTextFormatter: (svc: TextFormatter) => void;
  getShortcutManager: () => ShortcutManager;
  createOverlayWindow: () => void;
}
