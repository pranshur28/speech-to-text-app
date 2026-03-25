# Quick Start Guide

## 1. Get Your API Keys

### Deepgram (Real-time Streaming Transcription)
1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign in or create an account
3. Create a new API key
4. Copy the key

### OpenAI (Formatting + Fallback Transcription)
1. Go to [OpenAI's API keys page](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key

## 2. Set Up the Project

```bash
cd speech-to-text-app
npm install
cp .env.example .env
```

Edit `.env` and paste your OpenAI API key:
```
OPENAI_API_KEY=sk-your-key-here
```

(You can also configure both keys in the app's Settings tab.)

## 3. Run the App

### Development Mode (with Electron + hot reload)
```bash
npm run dev:electron
```

This will:
- Start the Vite dev server on port 5173
- Build the Electron main process
- Launch the Electron app

### Just the Dev Server (for testing React components)
```bash
npm run dev
```

## 4. Configure API Keys

1. Open the app and switch to the **Settings** tab
2. Enter your **Deepgram API Key** (for real-time streaming transcription)
3. Enter your **OpenAI API Key** (for formatting and Whisper fallback)
4. Keys are validated and saved locally

## 5. Using the App

### Push-to-Talk Mode (Recommended)
- Configure a hold shortcut in Settings (e.g., `Ctrl+Shift+H`)
- Hold the shortcut while speaking
- Release to transcribe, format, and paste

### Toggle Mode
- Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS) to start recording
- Press again to stop
- Text is transcribed via Deepgram, formatted by GPT-4o-mini, and pasted

### File Upload Mode
- Click "Choose Audio File"
- Select an MP3, WAV, FLAC, or other audio file
- The app will transcribe it via Whisper and format with GPT

### Custom Dictionary
- Open the **Settings** tab → Dictionary section
- Add phrase replacements (e.g., spoken "gonna" → replaced with "going to")
- Replacements are applied automatically after AI formatting

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

### API Key Issues
- Verify your OpenAI key starts with `sk-`
- Check you have API credits at https://platform.openai.com/account/billing/overview
- Verify your Deepgram key at https://console.deepgram.com/

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
│   │   ├── deepgram.ts                  # Deepgram WebSocket streaming
│   │   ├── transcription.ts             # OpenAI Whisper integration
│   │   ├── formatter.ts                 # GPT formatting logic
│   │   ├── paste.ts                     # Text pasting to active window
│   │   ├── dictionary.ts               # Custom phrase replacements
│   │   ├── database.ts                  # SQLite + FTS5 storage
│   │   ├── search.ts                    # Search with query parsing
│   │   └── config.ts                    # Configuration management
│   ├── shortcuts/
│   │   └── shortcut-manager.ts          # Global keyboard hooks
│   ├── ipc/                             # IPC handler modules
│   └── renderer/
│       ├── App.tsx                      # Main React component
│       ├── Overlay.tsx                  # Floating waveform overlay
│       └── components/
│           ├── SearchBar.tsx            # Debounced search
│           ├── NoteList.tsx             # Virtualized note list
│           ├── NoteCard.tsx             # Transcription card
│           ├── NoteDetailModal.tsx      # Full note view
│           ├── FilterPanel.tsx          # Search filters
│           ├── DictionarySettings.tsx   # Dictionary management UI
│           ├── PersistentHeader.tsx     # Status header
│           ├── TabBar.tsx               # Navigation tabs
│           ├── ContextualFooter.tsx     # Action buttons
│           └── ErrorBoundary.tsx        # Error handling
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
3. Verify your API keys are valid
4. Check system permissions for microphone and accessibility
