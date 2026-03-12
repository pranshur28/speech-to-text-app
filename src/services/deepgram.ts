import WebSocket from 'ws';
import log from '../utils/logger';

export type TranscriptCallback = (text: string, isFinal: boolean) => void;

export class DeepgramStreamingService {
  private ws: WebSocket | null = null;
  private finals: string[] = [];
  private keepaliveInterval: NodeJS.Timeout | null = null;
  private apiKey: string;
  private closed = false;
  private onTranscript: TranscriptCallback | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Register a callback to receive interim and final transcript chunks while recording. */
  setTranscriptCallback(cb: TranscriptCallback): void {
    this.onTranscript = cb;
  }

  startSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.finals = [];
      this.closed = false;

      const url =
        'wss://api.deepgram.com/v1/listen?' +
        'model=nova-3&punctuate=true&smart_format=true&interim_results=true&endpointing=300';

      this.ws = new WebSocket(url, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });

      this.ws.on('open', () => {
        log.info('Deepgram WebSocket connected');
        // Keepalive every 5s to prevent idle timeout
        this.keepaliveInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 5000);
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'Results') {
            const transcript = msg.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
              if (msg.is_final) {
                this.finals.push(transcript);
                log.debug('Deepgram final:', transcript);
              }
              if (this.onTranscript) {
                this.onTranscript(transcript, !!msg.is_final);
              }
            }
          }
        } catch (err) {
          log.error('Deepgram message parse error:', err);
        }
      });

      this.ws.on('error', (err) => {
        log.error('Deepgram WebSocket error:', err);
        this.closed = true;
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          reject(err);
        }
      });

      this.ws.on('close', (code, reason) => {
        log.info(`Deepgram WebSocket closed: ${code} ${reason}`);
        this.closed = true;
        this.clearKeepalive();
      });
    });
  }

  sendAudio(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  stopSession(): Promise<string> {
    return new Promise((resolve) => {
      this.clearKeepalive();

      if (!this.ws || this.closed || this.ws.readyState !== WebSocket.OPEN) {
        resolve(this.finals.join(' '));
        return;
      }

      // Timeout: if we don't get final results within 2s, return what we have
      const timeout = setTimeout(() => {
        log.warn('Deepgram finalize timeout, returning partial transcript');
        this.closeSocket();
        resolve(this.finals.join(' '));
      }, 2000);

      // Listen for the final results after Finalize
      const onMessage = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'Results' && msg.is_final) {
            const transcript = msg.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
              this.finals.push(transcript);
            }
          }
          // Deepgram sends a Finalize response after processing remaining audio
          if (msg.type === 'Finalize') {
            clearTimeout(timeout);
            this.ws?.removeListener('message', onMessage);
            this.closeSocket();
            resolve(this.finals.join(' '));
          }
        } catch (err) {
          // ignore parse errors during shutdown
        }
      };

      this.ws.on('message', onMessage);

      // Send Finalize to flush remaining audio
      this.ws.send(JSON.stringify({ type: 'Finalize' }));
    });
  }

  private closeSocket(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.ws.close();
      } catch (e) {
        // ignore close errors
      }
      this.ws = null;
    }
    this.closed = true;
  }

  private clearKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
}
