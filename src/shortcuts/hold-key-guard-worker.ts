/**
 * Windows low-level keyboard hook, run on its own thread so it never waits on the main
 * thread (Windows silently drops a hook that answers slowly). See hold-key-guard.ts.
 *
 * Shared state (Int32Array over a SharedArrayBuffer):
 *   [ACTIVE]       1 while hold-to-talk is held: swallow physical presses of the hold key
 *   [SCAN]         hold key scan code
 *   [EXTENDED]     1 if the hold key is an extended key
 *   [MODIFIERS]    physically held modifiers, as MODIFIER_BITS
 *   [THREAD_ID]    this thread's Win32 id, so the main thread can post WM_QUIT
 */
import { parentPort, workerData } from 'worker_threads';
import { SLOT, LLKHF_EXTENDED, LLKHF_INJECTED, MODIFIER_BITS } from './hold-key-guard-shared';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require('koffi');

const WH_KEYBOARD_LL = 13;
const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const WM_SYSKEYDOWN = 0x0104;
const WM_SYSKEYUP = 0x0105;

const state = new Int32Array(workerData.shared as SharedArrayBuffer);

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32',
  scanCode: 'uint32',
  flags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr',
});
const MSG = koffi.struct('MSG', {
  hwnd: 'void *',
  message: 'uint32',
  wParam: 'uintptr',
  lParam: 'intptr',
  time: 'uint32',
  x: 'int32',
  y: 'int32',
  lPrivate: 'uint32',
});
const HookProc = koffi.proto('intptr __stdcall HookProc(int nCode, uintptr wParam, void *lParam)');

const SetWindowsHookExW = user32.func('void * __stdcall SetWindowsHookExW(int idHook, HookProc *lpfn, void *hmod, uint32 threadId)');
const CallNextHookEx = user32.func('intptr __stdcall CallNextHookEx(void *hhk, int nCode, uintptr wParam, void *lParam)');
const UnhookWindowsHookEx = user32.func('bool __stdcall UnhookWindowsHookEx(void *hhk)');
const GetMessageW = user32.func('int __stdcall GetMessageW(_Out_ MSG *msg, void *hwnd, uint32 min, uint32 max)');
const GetModuleHandleW = kernel32.func('void * __stdcall GetModuleHandleW(const char16_t *name)');
const GetCurrentThreadId = kernel32.func('uint32 __stdcall GetCurrentThreadId()');

const hookProc = (nCode: number, wParam: number, lParam: unknown): number => {
  if (nCode >= 0) {
    const key = koffi.decode(lParam, KBDLLHOOKSTRUCT);
    // Our own typing (and other software's) is injected; only real key presses count
    if (!(key.flags & LLKHF_INJECTED)) {
      const down = wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN;
      const up = wParam === WM_KEYUP || wParam === WM_SYSKEYUP;
      const bit = MODIFIER_BITS[key.vkCode];
      if (bit) {
        if (down) Atomics.or(state, SLOT.MODIFIERS, bit);
        if (up) Atomics.and(state, SLOT.MODIFIERS, ~bit);
      } else if (
        Atomics.load(state, SLOT.ACTIVE) === 1 &&
        key.scanCode === Atomics.load(state, SLOT.SCAN) &&
        (key.flags & LLKHF_EXTENDED ? 1 : 0) === Atomics.load(state, SLOT.EXTENDED)
      ) {
        // Auto-repeat of the held hotkey would otherwise reach the focused app
        if (down) return 1;
        if (up) parentPort?.postMessage('hold-key-up');
      }
    }
  }
  return CallNextHookEx(null, nCode, wParam, lParam);
};

const callback = koffi.register(hookProc, koffi.pointer(HookProc));
const hook = SetWindowsHookExW(WH_KEYBOARD_LL, callback, GetModuleHandleW(null), 0);
if (!hook) {
  parentPort?.postMessage('failed');
} else {
  Atomics.store(state, SLOT.THREAD_ID, GetCurrentThreadId());
  parentPort?.postMessage('ready');

  // Hook callbacks run on this thread while it waits for messages; WM_QUIT ends the loop
  const msg = {};
  while (GetMessageW(msg, null, 0, 0) > 0) { /* no windows on this thread */ }

  UnhookWindowsHookEx(hook);
}
koffi.unregister(callback);
