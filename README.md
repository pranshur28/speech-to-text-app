# Speech to Text

Dictate into any app on Windows. Press a shortcut, talk, and your words are typed into whatever window you're in (email, chat, docs, code editor) as you speak. Every dictation is saved to a searchable history.

Transcription is powered by [Deepgram](https://deepgram.com/) streaming, so text appears in real time instead of after you stop.

[![Latest release](https://img.shields.io/github/v/release/pranshur28/speech-to-text-app)](https://github.com/pranshur28/speech-to-text-app/releases/latest)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-blue)

---

## Install

### One command (recommended)

Open **PowerShell** (press Start, type `PowerShell`, press Enter) and paste:

```powershell
irm https://raw.githubusercontent.com/pranshur28/speech-to-text-app/main/install.ps1 | iex
```

This downloads the newest version from [Releases](https://github.com/pranshur28/speech-to-text-app/releases/latest), installs it for your Windows user (no admin rights needed) and starts the app.

**To update later**, run the same command again. Your settings, history and dictionary are kept.

### Manual download

1. Go to the [latest release](https://github.com/pranshur28/speech-to-text-app/releases/latest).
2. Download **Speech.to.Text.Setup.x.y.z.exe** and run it.
3. Windows may show a blue **"Windows protected your PC"** screen because the app isn't code-signed. Click **More info → Run anyway**.

Prefer not to install? Download **Speech.to.Text.x.y.z.exe** instead. It's a portable version that runs without installing.

### Uninstall

**Settings → Apps → Installed apps → Speech to Text → Uninstall.**

---

## First-time setup

1. **Get a Deepgram API key.** Sign up at [console.deepgram.com](https://console.deepgram.com/) (new accounts come with free credit) and create an API key.
2. **Add the key to the app.** Open the **Settings** tab, paste the key into **Deepgram API key** and save.
3. **Allow the microphone** if Windows asks. If it doesn't work, check **Windows Settings → Privacy & security → Microphone** and turn on microphone access for desktop apps.

You're ready to dictate.

---

## How to use

Click into the place you want to type (a chat box, an email, a document), then use one of the two shortcuts. The app doesn't need to be in front; shortcuts work from anywhere.

### Toggle mode: press to start, press to stop

| Step | What to do |
|------|------------|
| Start | Press **Ctrl+Shift+Space** (the default; change it under **Start / stop** in Settings) |
| Talk | Words appear as you speak and are corrected in place as the transcription firms up |
| Stop | Press **Ctrl+Shift+Space** again |

Best for longer dictation. You can pause and resume from the recording indicator.

### Push-to-talk: hold to talk, let go to stop

Set a **Hold to talk** shortcut in **Settings** first (for example **Ctrl+Shift+X**). Then:

1. Hold the shortcut down.
2. Talk. Text is typed while you're still holding the keys.
3. Let go to stop.

Best for quick messages.

### The recording indicator

While recording, a glowing dot appears just above the taskbar on the monitor your mouse is on, and ripples outward as you speak. Hover over it to show the timer and the **pause** and **stop** buttons. The buttons are hidden in push-to-talk, where letting go stops. It never takes focus away from the app you're typing into.

### Press Enter with your voice

Pause, say **"period"** on its own, then pause again, and the app presses **Enter** (handy for sending a chat message) and keeps listening. Said in the middle of a sentence, "period" is just a word. You can change the phrase or turn this off in **Settings → Voice commands**.

### History

Every dictation is saved. Open the **History** tab to:

- **Search** everything you've said. Filters such as `fav:true`, `date:today`, `tag:work` or `#meeting` narrow it down.
- **Open** a note to copy it, favorite it or delete it.

### Custom dictionary

In **Settings → Dictionary**, add words the app should get right. Each entry is **When I say** → **Write**:

- **Fix recurring mistakes:** "gonna" → "going to", "react js" → "React.js".
- **Teach names and jargon:** add the word with itself as the replacement (e.g. "Kubernetes" → "Kubernetes"). Dictionary words are also sent to Deepgram as hints, so they're recognized correctly in the first place.
- Turn entries on or off without deleting them.

### Settings at a glance

| Setting | What it does |
|---------|--------------|
| **Deepgram API key** | Required for transcription |
| **Model** | **Flux** (default): finishes whole sentences cleanly. **Nova-3**: formats numbers and dates and understands spoken punctuation ("comma", "new line", "new paragraph") |
| **Type as you speak** | On (default): words appear live. Off: each phrase is pasted once it's final (your clipboard is restored afterwards) |
| **Start / stop** and **Hold to talk** | Change either shortcut: click the field and press the keys you want |
| **Voice commands** | **Press Enter by voice** on or off, and the **Phrase** that triggers it |

### Closing the app

Closing the window keeps the app running in the **system tray** (bottom-right, near the clock) so your shortcuts keep working. To fully exit, right-click the tray icon → **Quit**.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Nothing gets typed** | Make sure the cursor is in a text box before you start. Some apps that run as administrator block typed input from regular apps. |
| **"Deepgram rejected the API key"** | Re-enter the key in Settings and check you still have credit at [console.deepgram.com](https://console.deepgram.com/). |
| **Error mentioning "400" with a big dictionary** | Too many dictionary hints. Turn some entries off. |
| **Empty transcription / "No speech detected"** | Check the right microphone is selected in Windows sound settings and that it works in another app. |
| **Shortcut does nothing** | Another app may use the same shortcut. Pick a different one in Settings. Only run one copy of the app at a time. |
| **Recording stops with "Connection lost"** | Your internet dropped. Everything transcribed up to that point was already typed and saved. |

---

## Privacy

- **Stays on your computer:** your history, dictionary, settings and API key (in `%APPDATA%\speech-to-text-app`).
- **Sent to Deepgram:** your audio while recording, and your enabled dictionary words, for transcription only.
- **Never collected:** no accounts, analytics or telemetry. No cloud copy of your notes.

---

## For developers

<details>
<summary>Build and run from source</summary>

### Requirements

- Windows x64, **Node.js 18+**
- **Visual Studio Build Tools** with the "Desktop development with C++" workload (native modules such as better-sqlite3 compile during `npm install`)

### Setup

```powershell
git clone https://github.com/pranshur28/speech-to-text-app.git
cd speech-to-text-app
npm install
```

Optionally copy `.env.example` to `.env` and set `DEEPGRAM_API_KEY`, or enter the key in the app.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev:electron` | Run the app with hot reload |
| `npm test` | Run the test suite (Jest) |
| `npm run dist` | Build the installer and portable exe into `release/` |

Close the installed app before running the dev build: they share one data folder and the same global shortcuts. Close the dev app before `npm run dist`, or the native module rebuild fails with `EPERM`.

### Releasing

1. Bump the version: `npm version x.y.z --no-git-tag-version`, then commit.
2. `npm run dist`
3. Push, then publish a GitHub release with `release\Speech to Text Setup x.y.z.exe` and the portable exe attached. `install.ps1` always installs the asset named `*Setup*.exe` from the latest release.

### How it works

| Part | Where |
|------|-------|
| Electron main process, windows, tray | `src/main.ts` |
| Deepgram streaming (Flux / Nova-3 over WebSocket) | `src/services/deepgram.ts`, `src/ipc/deepgram.ts` |
| Live typing with in-place correction | `src/services/live-typer.ts` |
| Clipboard paste and key simulation (nut-js) | `src/services/paste.ts` |
| Global shortcuts (uiohook) | `src/shortcuts/shortcut-manager.ts` |
| Typing while push-to-talk is held (Windows keyboard hook via koffi, on a worker thread) | `src/shortcuts/hold-key-guard*.ts` |
| History storage and full-text search (SQLite FTS5) | `src/services/database.ts`, `src/services/search.ts` |
| React UI and recording indicator | `src/renderer/` |

**Stack:** Electron 27, React 18, TypeScript, Vite, better-sqlite3, uiohook-napi, nut-js, koffi, Radix UI, Jest.

More detail: [FEATURES.md](FEATURES.md).

</details>
