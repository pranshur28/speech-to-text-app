// Fake WebSocket: records what was sent and lets tests push server messages
jest.mock('ws', () => {
  const { EventEmitter } = require('events');

  class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static instances: MockWebSocket[] = [];

    readyState = MockWebSocket.CONNECTING;
    sent: any[] = [];

    constructor(public url: string, public options: any) {
      super();
      MockWebSocket.instances.push(this);
    }

    open() {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }

    receive(msg: object) {
      this.emit('message', Buffer.from(JSON.stringify(msg)));
    }

    send(data: any) {
      this.sent.push(typeof data === 'string' ? JSON.parse(data) : data);
    }

    close() {
      if (this.readyState === MockWebSocket.CLOSED) return;
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', 1000, '');
    }

    // Server-side drop
    drop(code = 1011) {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', code, 'server error');
    }
  }

  return { __esModule: true, default: MockWebSocket };
});
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.') } }));

const FakeWebSocket = (jest.requireMock('ws') as any).default;

import {
  DeepgramStreamingService,
  buildListenUrl,
  parseDeepgramMessage,
  describeConnectionError,
} from '../deepgram';

const novaResult = (transcript: string, isFinal: boolean, extra: object = {}) => ({
  type: 'Results',
  is_final: isFinal,
  channel: { alternatives: [{ transcript }] },
  ...extra,
});

const fluxTurn = (event: string, transcript: string, extra: object = {}) => ({
  type: 'TurnInfo',
  event,
  transcript,
  ...extra,
});

describe('buildListenUrl', () => {
  test('Nova-3 uses v1 with formatting and dictation', () => {
    const url = new URL(buildListenUrl('nova-3'));
    expect(url.origin + url.pathname).toBe('wss://api.deepgram.com/v1/listen');
    expect(url.searchParams.get('model')).toBe('nova-3');
    expect(url.searchParams.get('dictation')).toBe('true');
    expect(url.searchParams.get('punctuate')).toBe('true');
    expect(url.searchParams.get('smart_format')).toBe('true');
  });

  test('Flux uses v2 with the English model', () => {
    const url = new URL(buildListenUrl('flux'));
    expect(url.origin + url.pathname).toBe('wss://api.deepgram.com/v2/listen');
    expect(url.searchParams.get('model')).toBe('flux-general-en');
    expect(url.searchParams.has('dictation')).toBe(false);
  });

  test('sends each keyterm as a repeated parameter', () => {
    const url = new URL(buildListenUrl('flux', ['Kleene star', 'Deepgram']));
    expect(url.searchParams.getAll('keyterm')).toEqual(['Kleene star', 'Deepgram']);
  });
});

describe('parseDeepgramMessage', () => {
  test('Nova-3 interim and final results', () => {
    expect(parseDeepgramMessage('nova-3', novaResult('hello', false)))
      .toEqual([{ type: 'transcript', text: 'hello', isFinal: false }]);
    expect(parseDeepgramMessage('nova-3', novaResult('hello world', true)))
      .toEqual([{ type: 'transcript', text: 'hello world', isFinal: true }]);
  });

  test('Nova-3 finalize response is reported as flushed', () => {
    expect(parseDeepgramMessage('nova-3', novaResult('', true, { from_finalize: true })))
      .toEqual([{ type: 'flushed' }]);
  });

  test('Flux turn lifecycle', () => {
    expect(parseDeepgramMessage('flux', fluxTurn('StartOfTurn', ''))).toEqual([{ type: 'turn-start' }]);
    expect(parseDeepgramMessage('flux', fluxTurn('Update', 'so the plan')))
      .toEqual([{ type: 'transcript', text: 'so the plan', isFinal: false }]);
    expect(parseDeepgramMessage('flux', fluxTurn('EndOfTurn', 'so the plan is set', { trigger: 'model' })))
      .toEqual([
        { type: 'transcript', text: 'so the plan is set', isFinal: true },
        { type: 'turn-end', manual: false },
      ]);
  });

  test('errors are surfaced', () => {
    expect(parseDeepgramMessage('flux', { type: 'Error', description: 'bad audio' }))
      .toEqual([{ type: 'error', message: 'bad audio' }]);
  });

  test('ignores unrelated messages', () => {
    expect(parseDeepgramMessage('nova-3', { type: 'Metadata' })).toEqual([]);
    expect(parseDeepgramMessage('flux', { type: 'Connected' })).toEqual([]);
  });
});

describe('describeConnectionError', () => {
  test.each([
    ['Unexpected server response: 401', 'API key'],
    ['Unexpected server response: 400', 'dictionary'],
    ['getaddrinfo ENOTFOUND api.deepgram.com', 'internet connection'],
    ['Opening handshake has timed out', 'internet connection'],
  ])('%s', (message, expected) => {
    expect(describeConnectionError(new Error(message))).toContain(expected);
  });
});

describe('DeepgramStreamingService', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const start = async (engine: 'nova-3' | 'flux', keyterms: string[] = []) => {
    const svc = new DeepgramStreamingService('key', engine, keyterms);
    const transcripts: Array<[string, boolean]> = [];
    const disconnects: string[] = [];
    svc.setTranscriptCallback((text, isFinal) => transcripts.push([text, isFinal]));
    svc.setDisconnectCallback((message) => disconnects.push(message));
    const started = svc.startSession();
    const ws = FakeWebSocket.instances[0];
    ws.open();
    await started;
    return { svc, ws, transcripts, disconnects };
  };

  test('sends the API key and keyterms', async () => {
    const { ws } = await start('nova-3', ['Deepgram']);
    expect(ws.options.headers.Authorization).toBe('Token key');
    expect(new URL(ws.url).searchParams.getAll('keyterm')).toEqual(['Deepgram']);
  });

  test('Nova-3 stop resolves on the finalize response without waiting for the timeout', async () => {
    const { svc, ws, transcripts } = await start('nova-3');
    ws.receive(novaResult('first phrase', true));

    const stopped = svc.stopSession();
    expect(ws.sent).toContainEqual({ type: 'Finalize' });
    ws.receive(novaResult('last words', true, { from_finalize: true }));

    await expect(stopped).resolves.toBe('first phrase last words');
    expect(transcripts).toEqual([['first phrase', true], ['last words', true]]);
    expect(ws.sent).toContainEqual({ type: 'CloseStream' });
  });

  test('final phrases are not duplicated in the saved transcript', async () => {
    const { svc, ws } = await start('nova-3');
    const stopped = svc.stopSession();
    ws.receive(novaResult('only once', true));
    ws.receive(novaResult('', true, { from_finalize: true }));
    await expect(stopped).resolves.toBe('only once');
  });

  test('stop falls back to a timeout if Deepgram never answers', async () => {
    const { svc, ws } = await start('nova-3');
    ws.receive(novaResult('kept', true));
    const stopped = svc.stopSession();
    jest.advanceTimersByTime(2000);
    await expect(stopped).resolves.toBe('kept');
  });

  test('Flux stop forces the end of an in-progress turn', async () => {
    const { svc, ws, transcripts } = await start('flux');
    ws.receive(fluxTurn('StartOfTurn', ''));
    ws.receive(fluxTurn('Update', 'almost done'));

    const stopped = svc.stopSession();
    expect(ws.sent).toContainEqual({ type: 'ForceEndTurn' });
    ws.receive(fluxTurn('EndOfTurn', 'almost done here', { trigger: 'manual' }));

    await expect(stopped).resolves.toBe('almost done here');
    expect(transcripts).toEqual([['almost done', false], ['almost done here', true]]);
  });

  test('Flux stop with no turn in progress closes immediately', async () => {
    const { svc, ws } = await start('flux');
    ws.receive(fluxTurn('EndOfTurn', 'complete sentence', { trigger: 'model' }));

    await expect(svc.stopSession()).resolves.toBe('complete sentence');
    expect(ws.sent).not.toContainEqual({ type: 'ForceEndTurn' });
  });

  test('Flux does not send KeepAlive (undocumented for v2)', async () => {
    const { ws } = await start('flux');
    jest.advanceTimersByTime(15000);
    expect(ws.sent).not.toContainEqual({ type: 'KeepAlive' });
  });

  test('Nova-3 sends KeepAlive while open', async () => {
    const { ws } = await start('nova-3');
    jest.advanceTimersByTime(5000);
    expect(ws.sent).toContainEqual({ type: 'KeepAlive' });
  });

  test('reports a dropped connection mid-session but keeps what was transcribed', async () => {
    const { svc, ws, disconnects } = await start('nova-3');
    ws.receive(novaResult('before the drop', true));
    ws.drop(1011);

    expect(disconnects).toHaveLength(1);
    expect(disconnects[0]).toContain('lost');
    await expect(svc.stopSession()).resolves.toBe('before the drop');
  });

  test('a normal stop is not reported as a disconnect', async () => {
    const { svc, ws, disconnects } = await start('nova-3');
    const stopped = svc.stopSession();
    ws.receive(novaResult('', true, { from_finalize: true }));
    await stopped;
    expect(disconnects).toEqual([]);
  });

  test('connection failure rejects with a readable message', async () => {
    const svc = new DeepgramStreamingService('bad', 'flux');
    const started = svc.startSession();
    FakeWebSocket.instances[0].emit('error', new Error('Unexpected server response: 401'));
    await expect(started).rejects.toThrow('API key');
  });
});
