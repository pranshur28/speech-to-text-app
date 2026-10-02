# Quick Start Guide

## 1. Get Your Deepgram API Key

1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign in or create an account
3. Create a new API key
4. Copy the key

## 2. Set Up the Project

```bash
cd speech-to-text-app
npm install
cp .env.example .env
```

Edit `.env` and paste your Deepgram API key:
```
DEEPGRAM_API_KEY=your-key-here
```

(You can also enter the key in the app's Settings tab.)

## 3. Run the App

### Development Mode (with Electron + hot reload)
```bash
npm run dev:electron
```

This will:
- Start the Vite dev server on port 5173
- Build the Electron main process
- Launch the Electron app

Code changes reload automatically — no need to build an installer to try them.

### Just the Dev Server (for testing React components)
```bash
npm run dev
```

### Tests
```bash
npm test
```
Tests run inside Electron's Node.js so the native SQLite module loads without rebuilding.

## 4. Configure Settings

1. Open the app and switch to the **Settings** tab
2. Enter your **Deepgram API Key** and click Save
3. Pick a **Transcription Model**:
   - **Flux** (default) — pastes whole sentences, using Deepgram's end-of-turn detection
   - **Nova-3** — formats numbers/dates and understands spoken "comma", "period", "new line", "new paragraph"

## 5. Using the App

### Push-to-Talk Mode (Recommended)
- Configure a hold shortcut in Settings (e.g., `Ctrl+Shift+H`)
- Hold the shortcut while speaking
- Release to stop; the last words are finalized (with a modifier in the hold key, text appears when you release)

### Toggle Mode
- Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS) to start recording
- Words appear in the focused app as you speak (turn off "Type as you speak" in Settings to paste whole phrases instead)
- Press again to stop; the full transcript is saved to History

### Hands-free Enter
- Pause, say **"period"** on its own, then pause — the app presses Enter and keeps listening
- Said inside a sentence ("…and that's final, period.") it's typed as a normal word
- Change the phrase or turn it off in Settings → Transcription → Voice commands

### Custom Dictionary
- Open the **Settings** tab → Dictionary section
- Add phrase replacements (e.g., spoken "gonna" → replaced with "going to")
- Enabled entries are also sent to Deepgram as keyterms, improving recognition of names and jargon
- To teach a word without changing it, add it with itself as the replacement

### Searching Your Notes
- Switch to the **History** tab to browse transcriptions
- Use the search bar with full-text search
- Special filters: `tag:work`, `#meeting`, `fav:true`, `date:today`

## Troubleshooting

### Build Errors
```bash
# Clean and reinstall
rm -rf node_modules dist build
npm install
```

### Microphone Not Working
- Check your system permissions
- On macOS: System Preferences → Security & Privacy → Microphone
- On Windows: Settings → Privacy & Security → Microphone

### Deepgram Errors
- The app shows the reason when it can't connect (invalid key, no internet, out of credit)
- Verify your key and credit at https://console.deepgram.com/
- A "400" error with many dictionary entries means the keyterm list was rejected — disable some entries

### Pasting Not Working
- Grant accessibility permissions:
  - macOS: System Preferences → Security & Privacy → Accessibility
  - Windows: Settings → Privacy & Security → Accessibility

## Next Steps

1. **Custom Dictionary**: Add phrase replacements in Settings for domain-specific terms
2. **Build for Distribution**: Run `npm run dist` to create installer files
3. **Customize Shortcuts**: Set up toggle and hold shortcuts in Settings

## File Structure

```
speech-to-text-app/
├── src/
│   ├── main.ts                          # Electron main process
│   ├── preload.ts                       # Secure IPC bridge
│   ├── services/
│   │   ├── deepgram.ts                  # Deepgram Flux / Nova-3 WebSocket streaming
│   │   ├── paste.ts                     # Text pasting to active window (restores clipboard)
│   │   ├── dictionary.ts                # Phrase replacements + keyterms
│   │   ├── database.ts                  # SQLite + FTS5 storage
│   │   ├── search.ts                    # Search with query parsing
│   │   └── config.ts                    # Configuration management
│   ├── shortcuts/
│   │   └── shortcut-manager.ts          # Global keyboard hooks
│   ├── ipc/                             # IPC handler modules
│   └── renderer/
│       ├── App.tsx                      # Main React component (tabs + layout)
│       ├── Overlay.tsx                  # Floating waveform overlay
│       ├── recordingState.ts            # Recording state machine
│       ├── hooks/
│       │   └── useRecorder.ts           # Microphone + Deepgram session lifecycle
│       └── components/
│           ├── RecordingTab.tsx         # Record button, live transcript, recent history
│           ├── SettingsTab.tsx          # API key, model, shortcuts, dictionary
│           ├── ShortcutRecorder.tsx     # Shortcut capture control
│           ├── SearchBar.tsx            # Debounced search
│           ├── NoteList.tsx             # Virtualized note list
│           ├── NoteCard.tsx             # Transcription card
│           ├── NoteDetailModal.tsx      # Full note view
│           ├── FilterPanel.tsx          # Search filters
│           ├── DictionarySettings.tsx   # Dictionary management UI
│           ├── TopBar.tsx               # Status + tab navigation
│           ├── ContextualFooter.tsx     # Working keyboard shortcut hints
│           └── ErrorBoundary.tsx        # Error handling
├── scripts/
│   └── jest-electron.js                 # Runs Jest under Electron's Node.js
├── electron-builder.yml                 # Build configuration
├── vite.config.ts                       # Vite configuration
├── tsconfig.json                        # TypeScript configuration
├── .env.example                         # Environment variables template
└── README.md
```

## Support

For issues or questions:
1. Check the [README.md](README.md) for detailed documentation
2. Check [FEATURES.md](FEATURES.md) for feature details and roadmap
3. Verify your Deepgram API key is valid
4. Check system permissions for microphone and accessibility
