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
