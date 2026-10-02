import WebSocket from 'ws';
import log from '../utils/logger';
import { SttEngine } from './config';

export type TranscriptCallback = (text: string, isFinal: boolean) => void;
export type DisconnectCallback = (message: string) => void;

/** Normalized event parsed from a Deepgram server message (Nova-3 v1 or Flux v2). */
export type DeepgramEvent =
  | { type: 'transcript'; text: string; isFinal: boolean }
  | { type: 'turn-start' }
  | { type: 'turn-end'; manual: boolean }
  | { type: 'flushed' }
  | { type: 'error'; message: string };

const CONNECT_TIMEOUT_MS = 10000;
const STOP_TIMEOUT_MS = 2000;

/** Build the streaming URL for the selected engine. Keyterms are sent as repeated `keyterm` params. */
export function buildListenUrl(engine: SttEngine, keyterms: string[] = []): string {
  const params = new URLSearchParams();
  let base: string;

  if (engine === 'flux') {
    // Flux auto-detects containerized audio (WebM/Opus), so no encoding/sample_rate params
    base = 'wss://api.deepgram.com/v2/listen';
    params.set('model', 'flux-general-en');
  } else {
    base = 'wss://api.deepgram.com/v1/listen';
    params.set('model', 'nova-3');
    params.set('punctuate', 'true');
    params.set('smart_format', 'true');
    params.set('dictation', 'true');
    params.set('interim_results', 'true');
    params.set('endpointing', '300');
  }

  for (const term of keyterms) {
    params.append('keyterm', term);
  }

  return `${base}?${params.toString()}`;
}

/** Translate a raw Deepgram message into zero or more normalized events. */
export function parseDeepgramMessage(engine: SttEngine, msg: any): DeepgramEvent[] {
  if (!msg || typeof msg !== 'object') return [];

  if (msg.type === 'Error') {
    return [{ type: 'error', message: msg.description || msg.code || 'Deepgram error' }];
  }

  if (engine === 'flux') {
    if (msg.type !== 'TurnInfo') return [];
    const text = typeof msg.transcript === 'string' ? msg.transcript.trim() : '';
    switch (msg.event) {
      case 'StartOfTurn':
        return [{ type: 'turn-start' }];
      case 'Update':
      case 'TurnResumed':
        return text ? [{ type: 'transcript', text, isFinal: false }] : [];
      case 'EndOfTurn': {
        const events: DeepgramEvent[] = [];
        if (text) events.push({ type: 'transcript', text, isFinal: true });
        events.push({ type: 'turn-end', manual: msg.trigger === 'manual' });
        return events;
      }
      default:
        return [];
    }
  }

  if (msg.type !== 'Results') return [];
  const events: DeepgramEvent[] = [];
  const text = msg.channel?.alternatives?.[0]?.transcript;
  if (typeof text === 'string' && text.trim()) {
    events.push({ type: 'transcript', text: text.trim(), isFinal: !!msg.is_final });
  }
  if (msg.from_finalize) {
    events.push({ type: 'flushed' });
  }
  return events;
}

/** Turn a WebSocket connection error into a message the user can act on. */
export function describeConnectionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = message.match(/Unexpected server response: (\d+)/)?.[1];
  if (status === '401' || status === '403') {
    return 'Deepgram rejected the API key. Check it in Settings.';
  }
  if (status === '400') {
    return 'Deepgram rejected the request (400). If you have many dictionary entries, try disabling some.';
  }
  if (status === '402') {
    return 'Deepgram account is out of credit.';
  }
  if (status) {
    return `Deepgram returned an error (${status}). Try again shortly.`;
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ETIMEDOUT|timed out/i.test(message)) {
    return "Can't reach Deepgram. Check your internet connection.";
  }
  return `Could not connect to Deepgram: ${message}`;
}

export class DeepgramStreamingService {
  private ws: WebSocket | null = null;
  private finals: string[] = [];
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private stopping = false;
  private turnInProgress = false;
  private onTranscript: TranscriptCallback | null = null;
  private onDisconnect: DisconnectCallback | null = null;
  private resolveStop: (() => void) | null = null;

  constructor(
    private apiKey: string,
    private engine: SttEngine,
    private keyterms: string[] = []
  ) {}

  /** Register a callback to receive interim and final transcript chunks while recording. */
  setTranscriptCallback(cb: TranscriptCallback): void {
    this.onTranscript = cb;
  }

  /** Register a callback for when the connection drops or Deepgram reports an error mid-session. */
  setDisconnectCallback(cb: DisconnectCallback): void {
    this.onDisconnect = cb;
  }

  startSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.finals = [];
      this.stopping = false;
      this.turnInProgress = false;
      let opened = false;

      this.ws = new WebSocket(buildListenUrl(this.engine, this.keyterms), {
        headers: { Authorization: `Token ${this.apiKey}` },
        handshakeTimeout: CONNECT_TIMEOUT_MS,
      });

      this.ws.on('open', () => {
        opened = true;
        log.info(`Deepgram WebSocket connected (${this.engine}, ${this.keyterms.length} keyterms)`);
        // Nova-3 closes idle streams after ~10s; KeepAlive covers pauses. Flux does not document KeepAlive.
        if (this.engine === 'nova-3') {
          this.keepaliveInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
            }
          }, 5000);
        }
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        let msg: any;
        try {
          msg = JSON.parse(data.toString());
        } catch (err) {
          log.error('Deepgram message parse error:', err);
          return;
        }
        for (const event of parseDeepgramMessage(this.engine, msg)) {
          this.handleEvent(event);
        }
      });

      this.ws.on('error', (err) => {
        log.error('Deepgram WebSocket error:', err);
        if (!opened) {
          reject(new Error(describeConnectionError(err)));
        }
      });

      this.ws.on('close', (code, reason) => {
        log.info(`Deepgram WebSocket closed: ${code} ${reason}`);
        this.clearKeepalive();
        this.ws = null;
        if (opened && !this.stopping) {
          this.onDisconnect?.(`Connection to Deepgram was lost (code ${code}).`);
        }
        this.finishStop();
      });
    });
  }

  private handleEvent(event: DeepgramEvent): void {
    switch (event.type) {
      case 'transcript':
        this.turnInProgress = !event.isFinal;
        if (event.isFinal) {
          this.finals.push(event.text);
          log.debug('Deepgram final:', event.text);
        }
        this.onTranscript?.(event.text, event.isFinal);
        break;
      case 'turn-start':
        this.turnInProgress = true;
        break;
      case 'turn-end':
        this.turnInProgress = false;
        if (event.manual) this.finishStop();
        break;
      case 'flushed':
        this.finishStop();
        break;
      case 'error':
        log.error('Deepgram reported error:', event.message);
        if (!this.stopping) this.onDisconnect?.(`Deepgram error: ${event.message}`);
        break;
    }
  }

  sendAudio(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  /** Flush buffered audio, wait for the last transcript, close, and return the full transcript. */
  stopSession(): Promise<string> {
    return new Promise((resolve) => {
      this.stopping = true;
      this.clearKeepalive();

      const done = () => {
        clearTimeout(timeout);
        this.resolveStop = null;
        this.closeSocket();
        resolve(this.finals.join(' '));
      };
      const timeout = setTimeout(() => {
        log.warn('Deepgram flush timeout, returning transcript collected so far');
        done();
      }, STOP_TIMEOUT_MS);
      this.resolveStop = done;

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        done();
        return;
      }

      if (this.engine === 'flux') {
        if (!this.turnInProgress) {
          done();
          return;
        }
        this.ws.send(JSON.stringify({ type: 'ForceEndTurn' }));
      } else {
        this.ws.send(JSON.stringify({ type: 'Finalize' }));
      }
    });
  }

  private finishStop(): void {
    this.resolveStop?.();
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      }
      ws.close();
    } catch (e) {
      // ignore close errors
    }
  }

  private clearKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
}
