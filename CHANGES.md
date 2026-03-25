# Change Tracking

This document tracks problems encountered and the fixes applied.

---

## Problem 1: Paste not working in packaged Windows EXE

**Date:** 2026-03-16

**Symptom:** Transcription paste works in dev mode (`npm run dev:electron`) but fails silently when the app is packaged as an installed Windows EXE.

**Root Cause:** The `@nut-tree-fork/nut-js` library (used for keyboard simulation on Windows — Ctrl+V paste and `keyboard.type()`) depends on a native addon (`@nut-tree-fork/libnut-win32`). Three packaging configuration gaps prevented this native module from being available in the built app:

1. `electron-builder.yml` `files:` section had a blanket exclusion for all `build/` folders in native modules (`!**/node_modules/**/build/**/*`), with re-includes only for `better-sqlite3` — not for `libnut-win32`.
2. `electron-builder.yml` `asarUnpack:` only listed `better-sqlite3` and `uiohook-napi` — the `libnut-win32` `.node` binary and DLLs were trapped inside the asar archive where they can't be loaded.
3. `package.json` `postinstall` electron-rebuild only targeted `better-sqlite3` and `uiohook-napi` — `libnut-win32` was never recompiled against Electron's Node ABI.

**Fix Applied:**

1. **`electron-builder.yml` — `files:`** — Added re-include for libnut-win32 build output:
   ```yaml
   - "**/node_modules/@nut-tree-fork/libnut-win32/build/Release/*"
   ```

2. **`electron-builder.yml` — `asarUnpack:`** — Added entries to unpack native files to disk:
   ```yaml
   - "**/node_modules/@nut-tree-fork/libnut-win32/**/*.node"
   - "**/node_modules/@nut-tree-fork/libnut-win32/**/*.dll"
   ```

3. **`package.json` — `postinstall`** — Added `@nut-tree-fork/libnut-win32` to electron-rebuild:
   ```json
   "postinstall": "electron-rebuild -f -w better-sqlite3,uiohook-napi,@nut-tree-fork/libnut-win32"
   ```

**Files Changed:**
- `electron-builder.yml`
- `package.json`

---

## Problem 2: Push-to-talk paste stops recording and types hotkey characters

**Date:** 2026-03-16

**Symptom:** During push-to-talk (e.g. Ctrl+Shift+X held down), when Deepgram returns a finalized transcript and the app pastes it via Ctrl+V, recording stops prematurely. The remaining held key (X) gets typed as literal "x x x x" into the focused app.

**Root Cause:** `PasteService.paste()` uses nut-js to simulate `Ctrl+V` at the OS level. `uIOhook` (the global hotkey listener) sees these synthetic keystrokes as real events. When nut-js releases Ctrl as part of the paste, two things go wrong:
1. The `pressedKeys` set in `ShortcutManager` gets corrupted — Ctrl is removed even though the user is still physically holding it.
2. The OS itself considers Ctrl released, so the still-held X key becomes a literal typed "x".

This same key state corruption also broke **toggle mode** — the `checkModifiers()` strict equality check would fail on the second press because ghost modifier entries from paste polluted the `pressedKeys` set.

**Fix Applied:**

1. **`ShortcutManager` — paste mode** — Added `enterPasteMode()` / `exitPasteMode()` methods. During paste mode, all uIOhook key events are ignored (no `pressedKeys` updates, no shortcut triggers). On exit, `pressedKeys` is restored from a pre-paste snapshot.

2. **`PasteService.paste()` — modifier-aware** — Now accepts optional `heldModifiers` parameter. On Windows, if Ctrl is already physically held (push-to-talk), only simulates V press/release (Ctrl is already down at OS level). This avoids releasing the user's physical Ctrl.

3. **Deepgram IPC and audio-transcription IPC** — All paste calls now enter/exit paste mode and pass held modifier info to the paste service.

**Files Changed:**
- `src/shortcuts/shortcut-manager.ts`
- `src/services/paste.ts`
- `src/ipc/deepgram.ts`
- `src/ipc/audio-transcription.ts`
