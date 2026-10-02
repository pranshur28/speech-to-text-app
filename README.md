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
  - Pause/resume during recording
  - Visual waveform overlay with stop/pause controls

- **🤖 Deepgram Streaming Transcription** (choose in Settings)
  - **Flux** (default): Model-integrated end-of-turn detection, so text is pasted in whole sentences
  - **Nova-3**: Smart formatting (numbers, dates) and spoken punctuation ("comma", "period", "new line", "new paragraph")
  - Text is pasted live into the focused app; your clipboard is restored afterwards
  - Clear error messages (and a desktop notification when the window is hidden) if Deepgram can't connect or the connection drops

- **📖 Custom Dictionary**
  - Define custom phrase replacements (e.g., "gonna" → "going to")
  - Whole-word matching, case-sensitive or case-insensitive
  - Entries are also sent to Deepgram as **keyterms**, so names and jargon are recognized correctly in the first place
  - Enable/disable individual entries without deleting

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

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/pranshur28/speech-to-text-app.git
cd speech-to-text-app

# 2. Install dependencies
npm install

# 3. Set up your API key (optional - can configure in app)
cp .env.example .env
# Edit .env and add: DEEPGRAM_API_KEY=your-key-here
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
2. **Configure API Key** — Open the Settings tab and add your Deepgram API key
3. **Grant Permissions**:
   - **Microphone access** (for recording)
   - **Accessibility permissions** (for auto-paste on macOS)

### Recording & Transcription

**Method 1: Toggle Mode (Default)**
1. Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS)
2. Speak naturally — text is pasted into the active window as each sentence/phrase is finalized
3. Press the shortcut again to stop; the full transcript is saved to History

**Method 2: Push-to-Talk Mode**
1. Configure a hold shortcut in Settings
2. Hold the shortcut while speaking
3. Release to stop; the last words are flushed and pasted

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
- Enabled entries are sent to Deepgram as keyterms (up to ~450 tokens; the settings show how many)
- To teach Deepgram a word without changing it, add it with itself as the replacement

---

## Configuration

### Settings Panel

Access via the **Settings** tab:

- **Deepgram API Key**: Required for real-time streaming transcription
- **Transcription Model**: Flux (default, whole-sentence pasting) or Nova-3 (smart formatting + spoken punctuation)
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
- ⚠️ Enabled dictionary terms (to Deepgram as keyterms)

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

- ✅ Verify your Deepgram key and credit at [Deepgram Console](https://console.deepgram.com/)
- ✅ Try re-entering the key in Settings
- ✅ A "400" error with many dictionary entries means the keyterm list was rejected — disable some entries

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
│   │   ├── paste.ts                     # Cross-platform paste with modifier awareness
│   │   ├── dictionary.ts               # Custom phrase replacements
│   │   ├── database.ts                  # SQLite + FTS5
│   │   ├── search.ts                    # Search service with query parsing
│   │   └── config.ts                    # Config management
│   ├── shortcuts/
│   │   └── shortcut-manager.ts          # Global keyboard hooks with paste mode
│   ├── ipc/                             # IPC handler modules
│   │   ├── deepgram.ts                  # Streaming sessions, live paste, key + model settings
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
| **Deepgram Flux / Nova-3** | Real-time streaming transcription |
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
- Powered by [Deepgram](https://deepgram.com/) (Flux and Nova-3 streaming)
- UI built with [Radix UI](https://www.radix-ui.com/) primitives

---

**Version**: 1.0.0
**Last Updated**: 2026-03-25
