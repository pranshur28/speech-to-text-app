import path from 'path';
import { Worker } from 'worker_threads';
import log from '../utils/logger';
import {
  SLOT, SLOT_COUNT, EXTENDED_VKS, MENU_VKS, modifiersInMask, uiohookToScan,
} from './hold-key-guard-shared';

const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;
const WM_QUIT = 0x0012;
// Unassigned virtual key: tapping it before releasing Alt/Win keeps the menu bar / Start menu shut
const VK_MENU_MASK = 0xe8;

export interface LiftedModifiers {
  /** Press the lifted modifiers again if the user is still physically holding them. */
  restore(): void;
}

/**
 * Lets hold-to-talk type into the focused app while the hotkey is still held (Windows).
 *
 * While the hotkey is held, the focused app sees the held modifiers on everything we type
 * (Ctrl+H instead of "h"), and the held key auto-repeats into it. The guard's hook thread
 * swallows that auto-repeat and tracks which modifiers are physically down, so input can
 * briefly lift them. It also reports the real release of the hotkey, which our own typed
 * letters can't fake.
 */
export class HoldKeyGuard {
  private worker: Worker | null = null;
  private state = new Int32Array(new SharedArrayBuffer(SLOT_COUNT * 4));
  private ready = false;
  private win32: { keybdEvent: Function; mapVirtualKey: Function; postThreadMessage: Function } | null = null;

  constructor(private onHoldKeyUp: () => void) {}

  /** True once the hook is running; hold-to-talk release then comes from here, not uiohook. */
  get available(): boolean {
    return this.ready;
  }

  start(): void {
    if (process.platform !== 'win32' || this.worker) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const koffi = require('koffi');
      const user32 = koffi.load('user32.dll');
      this.win32 = {
        keybdEvent: user32.func('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr extra)'),
        mapVirtualKey: user32.func('uint32 __stdcall MapVirtualKeyW(uint32 code, uint32 mapType)'),
        postThreadMessage: user32.func('bool __stdcall PostThreadMessageW(uint32 threadId, uint32 msg, uintptr wParam, intptr lParam)'),
      };

      // Worker threads can't read from the asar archive; the worker and koffi are unpacked
      const script = path.join(__dirname, 'hold-key-guard-worker.js').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
      const worker = new Worker(script, { workerData: { shared: this.state.buffer } });
      worker.unref();
      worker.on('message', (message) => {
        if (message === 'ready') {
          this.ready = true;
          log.info('Hold-to-talk key guard running');
        } else if (message === 'failed') {
          log.warn('Hold-to-talk key guard: could not install keyboard hook');
        } else if (message === 'hold-key-up') {
          this.onHoldKeyUp();
        }
      });
      worker.on('error', (error) => log.error('Hold-to-talk key guard crashed:', error));
      worker.on('exit', () => {
        this.ready = false;
        this.worker = null;
      });
      this.worker = worker;
    } catch (error) {
      log.error('Hold-to-talk key guard unavailable:', error);
    }
  }

  /** Start swallowing the held hotkey's auto-repeat (`keycode` is a uiohook keycode). */
  activate(keycode: number): void {
    if (!this.ready) return;
    const { scan, extended } = uiohookToScan(keycode);
    Atomics.store(this.state, SLOT.SCAN, scan);
    Atomics.store(this.state, SLOT.EXTENDED, extended ? 1 : 0);
    Atomics.store(this.state, SLOT.ACTIVE, 1);
  }

  deactivate(): void {
    Atomics.store(this.state, SLOT.ACTIVE, 0);
  }

  /** Release the physically held modifiers for the duration of our input. Null when not holding. */
  liftModifiers(): LiftedModifiers | null {
    if (!this.ready || !this.win32 || Atomics.load(this.state, SLOT.ACTIVE) !== 1) return null;
    const liftedMask = Atomics.load(this.state, SLOT.MODIFIERS);
    const held = modifiersInMask(liftedMask);

    if (held.some((vk) => MENU_VKS.has(vk))) this.tap(VK_MENU_MASK);
    held.forEach((vk) => this.send(vk, true));

    return {
      restore: () => {
        // Only what is still physically down, so a modifier can never be left stuck
        const stillHeld = modifiersInMask(liftedMask & Atomics.load(this.state, SLOT.MODIFIERS));
        stillHeld.forEach((vk) => this.send(vk, false));
      },
    };
  }

  stop(): void {
    this.deactivate();
    const threadId = Atomics.load(this.state, SLOT.THREAD_ID);
    if (this.win32 && threadId) this.win32.postThreadMessage(threadId, WM_QUIT, 0, 0);
    this.ready = false;
  }

  private send(vk: number, up: boolean): void {
    const scan = this.win32!.mapVirtualKey(vk, 0);
    const flags = (up ? KEYEVENTF_KEYUP : 0) | (EXTENDED_VKS.has(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
    this.win32!.keybdEvent(vk, scan, flags, 0);
  }

  private tap(vk: number): void {
    this.send(vk, false);
    this.send(vk, true);
  }
}
