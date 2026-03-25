# Speech-to-Text Desktop App

A powerful, polished note-taking companion that transforms speech into searchable, organized, and beautifully formatted text using AI — with real-time streaming transcription.

**Status**: ✅ Core Features Complete (Recording, Streaming Transcription, Search, Dictionary)

[![Tests](https://img.shields.io/badge/tests-131%20passing-brightgreen)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)]()

---

## Features

### ✅ Current Features (Implemented)

- **🎤 Multiple Recording Modes**
  - Toggle mode: Click button to start/stop
  - Push-to-Talk: Hold shortcut while speaking (with paste mode to prevent key state corruption)
  - File upload: Transcribe existing audio files (mp3, wav, flac, ogg, aac, m4a)
  - Pause/resume during recording
  - Visual waveform overlay with stop/pause controls

- **🤖 Dual Transcription Engines**
  - **Deepgram Nova-3** (primary): Real-time streaming transcription via WebSocket with interim results, smart formatting, and 300ms endpointing
  - **OpenAI Whisper** (fallback): Batch transcription for file uploads
  - **GPT-4o-mini** for intelligent formatting with mathematical notation support (Unicode symbols, Greek letters, superscripts)
  - Automatic punctuation, capitalization, paragraph breaks, and filler word removal

- **📖 Custom Dictionary**
  - Define custom phrase replacements (e.g., "gonna" → "going to")
  - Case-sensitive or case-insensitive matching
  - Enable/disable individual entries without deleting
  - Applied automatically after formatting

- **⚡ Global Shortcuts**
  - Customizable keyboard shortcuts (works even when app isn't focused)
  - Default: `Command+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux)
  - Separate toggle and hold-to-record shortcuts
  - Visual shortcut recorder with modifier key detection and conflict warnings
  - Paste mode prevents modifier key corruption during push-to-talk

- **💾 Persistent Storage & Full-Text Search**
  - SQLite database with FTS5 full-text search
  - All transcriptions saved automatically
  - Instant search across all notes (<100ms)
  - Advanced query syntax: `tag:work`, `#meeting`, `fav:true`, `date:today`
  - Filter by favorites, date range, tags
  - Export to JSON, Markdown, or plain text
  - Auto-backup on app exit

- **📋 Workflow Automation**
  - Auto-paste formatted text to any application
  - Native keyboard simulation via nut-js (Windows) or AppleScript (macOS)
  - Recent transcriptions history with virtual scrolling
  - Background operation with system tray
  - Cross-platform paste support with serialized paste queue

- **🎨 Visual Feedback**
  - Real-time audio waveform visualization (12-bar display)
  - Always-on-top overlay with click-through design
  - Status indicators (Ready, Starting, Recording, Paused, Processing)
  - Color-coded waveform bars (green → yellow → red by intensity)
  - Dark theme with modern UI using Radix UI components

### 📋 Planned Features

See [FEATURES.md](FEATURES.md) for the complete feature roadmap including:
- Smart formatting profiles (5 built-in styles)
- Optional live preview with inline editing
- Intelligent tagging with AI suggestions
- Silence detection with auto-stop
- And much more...

---

## Quick Start

### Prerequisites

- **Node.js 16+** and npm
- **Operating System**: macOS, Windows, or Linux
- **API Keys**:
  - **Deepgram API key** (for real-time streaming transcription) — [Get one here](https://console.deepgram.com/)
  - **OpenAI API key** (for formatting + fallback transcription) — [Get one here](https://platform.openai.com/api-keys)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/pranshur28/speech-to-text-app.git
cd speech-to-text-app

# 2. Install dependencies
npm install

# 3. Set up your API key (optional - can configure in app)
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-your-key-here
```

### Running the App

```bash
# Development mode (with Electron hot reload)
npm run dev:electron

# Development mode (Vite dev server only, for React work)
npm run dev

# Build for distribution
npm run dist
```

---

## Usage

### First-Time Setup

1. **Launch the app** — Run `npm run dev:electron`
2. **Configure API Keys** — Open the Settings tab and add your Deepgram and OpenAI API keys
3. **Grant Permissions**:
   - **Microphone access** (for recording)
   - **Accessibility permissions** (for auto-paste on macOS)

### Recording & Transcription

**Method 1: Toggle Mode (Default)**
1. Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS)
2. Speak naturally — you'll see real-time interim transcription via Deepgram
3. Press the shortcut again to stop
4. Text is formatted by GPT-4o-mini and pasted to the active window

**Method 2: Push-to-Talk Mode**
1. Configure a hold shortcut in Settings
2. Hold the shortcut while speaking
3. Release to stop and process
4. Text is automatically formatted and pasted

**Method 3: File Upload**
1. Click the file upload button
2. Select an audio file
3. Wait for transcription (via Whisper) and formatting
4. Text is automatically pasted

### Searching Your Notes

- Switch to the **History** tab to browse all transcriptions
- Use the search bar with full-text search across all notes
- Special filters: `tag:work`, `#meeting`, `fav:true`, `date:today`
- Click any note to view details, re-paste, copy, or export

### Custom Dictionary

- Open the **Settings** tab and scroll to the Dictionary section
- Add phrase replacements (e.g., spoken "gonna" → replaced with "going to")
- Toggle case sensitivity per entry
- Enable/disable entries without deleting them
- Replacements are applied automatically after AI formatting

---

## Configuration

### Settings Panel

Access via the **Settings** tab:

- **OpenAI API Key**: Required for formatting and Whisper fallback transcription
- **Deepgram API Key**: Required for real-time streaming transcription
- **Toggle Shortcut**: Customize the toggle recording shortcut (default: `Ctrl+Shift+Space`)
- **Hold Shortcut**: Customize the push-to-talk shortcut
- **Custom Dictionary**: Manage phrase replacements

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Space` (macOS) | Toggle recording |
| `Ctrl+Shift+Space` (Windows/Linux) | Toggle recording |
| Custom hold shortcut | Hold to record (if configured) |

---

## Testing

Comprehensive test suite with **~131 tests** covering:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**
- ✅ DatabaseService: CRUD, search, export, backup/restore
- ✅ SearchService: Query parsing, filtering, pagination
- ✅ Integration tests: Complete workflow coverage
- ✅ UI Components: SearchBar, NoteCard, NoteList rendering

---

## Privacy & Security

### What's Stored Locally
- ✅ Transcriptions (in local SQLite database)
- ✅ API keys (in `{userData}/config.json`)
- ✅ Custom dictionary entries (in SQLite database)
- ✅ Settings (in localStorage and config)
- ✅ Database backups (`.bak` file created on exit)

### What's Sent Externally
- ⚠️ Audio stream (to Deepgram for real-time transcription)
- ⚠️ Audio recordings (to OpenAI Whisper for file transcription)
- ⚠️ Transcribed text (to OpenAI GPT-4o-mini for formatting)

### What's NOT Collected
- ❌ No telemetry or analytics
- ❌ No cloud storage of transcriptions
- ❌ No account registration required
- ❌ No data sharing with third parties

### Security Features
- Local-only storage (never leaves your computer except for API calls)
- Electron context isolation with secure preload bridge (no `nodeIntegration`)
- API key validation before saving
- Database auto-backup on exit

---

## Troubleshooting

### Microphone Access Denied

**macOS:**
```
System Preferences → Security & Privacy → Microphone
→ Check the box next to the app
```

**Windows:**
```
Settings → Privacy & Security → Microphone
→ Allow apps to access your microphone
```

**Linux:**
```
Check your audio settings and ensure the app has microphone permissions
```

### Auto-Paste Not Working

**macOS:**
```
System Preferences → Security & Privacy → Accessibility
→ Add the app and check the box
```

**Windows/Linux:**
- Ensure the app has permission to simulate keyboard input
- Some applications may block simulated paste events

### API Key Errors

- ✅ Verify your OpenAI key starts with `sk-`
- ✅ Check you have sufficient API credits at [OpenAI Platform](https://platform.openai.com/account/usage)
- ✅ Verify your Deepgram key at [Deepgram Console](https://console.deepgram.com/)
- ✅ Try re-entering the keys in Settings

### Database Issues

- Database is stored at: `{userData}/data/transcriptions.db`
- Backup file: `{userData}/data/transcriptions.db.bak`
- If corrupted, delete the `.db` file and restart (backup will be used)

### Empty Transcriptions

- Check your microphone is working (test in another app)
- Ensure you're speaking clearly and loud enough
- Try adjusting microphone volume in system settings
- Check background noise isn't too loud

---

## Development

### Project Structure

```
speech-to-text-app/
├── src/
│   ├── main.ts                          # Electron main process
│   ├── preload.ts                       # Secure IPC bridge
│   ├── renderer/                        # React UI
│   │   ├── App.tsx                      # Main component with tab navigation
│   │   ├── Overlay.tsx                  # Floating waveform overlay
│   │   ├── styles.css                   # Main styling
│   │   ├── overlay.css                  # Overlay styling
│   │   └── components/
│   │       ├── SearchBar.tsx            # Debounced search with filter syntax
│   │       ├── NoteList.tsx             # Virtualized note list (react-window)
│   │       ├── NoteCard.tsx             # Individual transcription card
│   │       ├── NoteDetailModal.tsx      # Full note view modal
│   │       ├── FilterPanel.tsx          # Date/favorite/tag filters
│   │       ├── DictionarySettings.tsx   # Custom phrase replacement UI
│   │       ├── PersistentHeader.tsx     # Recording status header
│   │       ├── TabBar.tsx               # Tab navigation
│   │       ├── ContextualFooter.tsx     # Action buttons
│   │       └── ErrorBoundary.tsx        # React error boundary
│   ├── services/                        # Business logic
│   │   ├── deepgram.ts                  # Deepgram WebSocket streaming
│   │   ├── transcription.ts             # OpenAI Whisper API
│   │   ├── formatter.ts                 # GPT-4o-mini formatting
│   │   ├── paste.ts                     # Cross-platform paste with modifier awareness
│   │   ├── dictionary.ts               # Custom phrase replacements
│   │   ├── database.ts                  # SQLite + FTS5
│   │   ├── search.ts                    # Search service with query parsing
│   │   └── config.ts                    # Config management
│   ├── shortcuts/
│   │   └── shortcut-manager.ts          # Global keyboard hooks with paste mode
│   ├── ipc/                             # IPC handler modules
│   │   ├── api-keys.ts                  # API key validation
│   │   ├── audio-transcription.ts       # Transcribe/format/type operations
│   │   ├── deepgram.ts                  # Streaming transcription handlers
│   │   ├── dictionary.ts               # Dictionary CRUD handlers
│   │   ├── database.ts                  # Database query handlers
│   │   ├── overlay.ts                   # Overlay window control
│   │   └── shortcuts.ts                # Shortcut management
│   └── __tests__/                       # Test files
├── FEATURES.md                          # Complete feature documentation
├── PROGRESS.md                          # Implementation progress tracker
├── QUICKSTART.md                        # Quick start guide
├── electron-builder.yml                 # Electron builder config
├── jest.config.js                       # Jest configuration
├── package.json                         # Dependencies
└── README.md                            # This file
```

### Tech Stack

| Technology | Purpose |
|------------|---------|
| **Electron 27** | Desktop application framework |
| **React 18** | UI components |
| **TypeScript 5.3** | Type-safe JavaScript |
| **Vite 5** | Fast build tool |
| **SQLite** (better-sqlite3) | Local database with FTS5 |
| **Deepgram Nova-3** | Real-time streaming transcription |
| **OpenAI API** | Whisper transcription + GPT-4o-mini formatting |
| **uiohook-napi** | Global keyboard shortcuts |
| **@nut-tree-fork/nut-js** | Native keyboard simulation (Windows) |
| **ws** | WebSocket client for Deepgram |
| **Radix UI** | Accessible UI primitives |
| **react-window** | Virtualized list rendering |
| **date-fns** | Date utilities |
| **electron-log** | Logging |
| **Jest** | Testing framework |

### Scripts

```bash
# Development
npm run dev              # Start Vite dev server + TypeScript watch
npm run dev:electron     # Start with Electron auto-reload
npm run build           # TypeScript compile + Vite build

# Testing
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Production
npm run dist            # Build distributable packages
```

---

## Building for Distribution

Create installers for your platform:

```bash
npm run dist
```

Output will be in the `release/` directory:
- **macOS**: `.dmg` installer + `.zip`
- **Windows**: NSIS `.exe` installer + portable `.exe`
- **Linux**: `.AppImage` and `.deb` packages

Native modules (better-sqlite3, uiohook-napi, nut-js) are automatically unpacked from the ASAR archive for compatibility.

---

## Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Persistent storage with SQLite
- [x] Full-text search with FTS5
- [x] Comprehensive test suite
- [x] Database integration
- [x] Auto-backup system

### ✅ Deepgram Streaming Integration (Complete)
- [x] Real-time WebSocket streaming transcription
- [x] Interim + final result handling
- [x] Live paste during recording
- [x] Serialized paste queue

### ✅ Dictionary & Paste Improvements (Complete)
- [x] Custom dictionary with CRUD operations
- [x] Paste mode to prevent key state corruption
- [x] Native keyboard simulation (nut-js)
- [x] Build configuration for packaged Windows EXE

### 📋 Phase 2: Smart Formatting
- [ ] 5 formatting profiles
- [ ] Optional live preview
- [ ] Inline text editing
- [ ] Profile customization

### 📋 Phase 3: Workflow Flexibility
- [ ] Flexible paste modes (immediate, clipboard-only, save-only)
- [ ] Quick actions & shortcuts
- [ ] Intelligent tagging with AI suggestions
- [ ] Tag management UI

### 📋 Phase 4: Recording Enhancements
- [ ] Silence detection
- [ ] Auto-stop on silence
- [ ] Final polish & accessibility

See [FEATURES.md](FEATURES.md) for complete roadmap and future enhancements.

---

## Contributing

Contributions are welcome! Please:

1. Read [FEATURES.md](FEATURES.md) to understand the vision
2. Create an issue to discuss your idea
3. Write tests for new features
4. Follow the existing code style
5. Update documentation

---

## License

This project is open source and available under the **MIT License**.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/pranshur28/speech-to-text-app/issues)
- **Documentation**: [FEATURES.md](FEATURES.md)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Tests**: Run `npm test` to verify functionality

---

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [Deepgram](https://deepgram.com/) (Nova-3 streaming) and [OpenAI](https://openai.com/) (Whisper + GPT)
- UI built with [Radix UI](https://www.radix-ui.com/) primitives

---

**Version**: 1.0.0
**Last Updated**: 2026-03-25
