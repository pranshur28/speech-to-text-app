# Speech-to-Text Desktop App

A powerful, polished note-taking companion that transforms speech into searchable, organized, and beautifully formatted text using AI.

**Status**: ✅ Phase 1 Complete (Persistent Storage & Search)

[![Tests](https://img.shields.io/badge/tests-70%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-75%25-green)]()

---

## Features

### ✅ Current Features (Implemented)

- **🎤 Multiple Recording Modes**
  - Toggle mode: Click button to start/stop
  - Push-to-Talk: Hold button while speaking
  - File upload: Transcribe existing audio files (mp3, wav, flac, ogg, aac, m4a)
  - Visual waveform overlay during recording

- **🤖 AI-Powered Transcription & Formatting**
  - OpenAI Whisper API for high-accuracy transcription
  - GPT-4o-mini for intelligent formatting
  - Automatic punctuation and capitalization
  - Paragraph breaks and structure
  - Filler word removal

- **⚡ Global Shortcuts**
  - Customizable keyboard shortcuts (works even when app isn't focused)
  - Default: `Command+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux)
  - Visual shortcut recorder with warnings for common keys

- **💾 Persistent Storage & Full-Text Search**
  - SQLite database with FTS5 search
  - All transcriptions saved automatically
  - Instant search across all notes (<100ms)
  - Filter by favorites, date range, tags
  - Export to JSON, Markdown, or plain text
  - Auto-backup on app exit

- **📋 Workflow Automation**
  - Auto-paste formatted text to any application
  - Recent transcriptions history (last 20)
  - Background operation with system tray
  - Cross-platform paste support

- **🎨 Visual Feedback**
  - Real-time audio waveform visualization
  - Status indicators (Ready, Listening, Thinking, Formatting, Pasting, Done)
  - Ripple animations and color-coded states
  - Dark theme with modern UI

### 📋 Planned Features

See [FEATURES.md](FEATURES.md) for the complete feature roadmap including:
- Smart formatting profiles (5 built-in styles)
- Optional live preview with inline editing
- Flexible paste modes (immediate, clipboard-only, save-only)
- Intelligent tagging with AI suggestions
- Pause/resume recording
- Silence detection with auto-stop
- And much more...

---

## Quick Start

### Prerequisites

- **Node.js 16+** and npm
- **Operating System**: macOS, Windows, or Linux
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))

### Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd speech-to-text-app

# 2. Install dependencies
npm install

# 3. Set up your API key (optional - can configure in app)
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=sk-your-key-here
```

### Running the App

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start

# Build for distribution
npm run dist
```

---

## Usage

### First-Time Setup

1. **Launch the app** - Run `npm start`
2. **Configure API Key** - Click the settings icon and add your OpenAI API key
3. **Grant Permissions**:
   - **Microphone access** (for recording)
   - **Accessibility permissions** (for auto-paste on macOS)

### Recording & Transcription

**Method 1: Toggle Mode (Default)**
1. Click the record button (or press `Cmd+Shift+Space`)
2. Speak naturally
3. Click again to stop (or press `Cmd+Shift+Space` again)
4. Text is automatically formatted and pasted

**Method 2: Push-to-Talk Mode**
1. Enable "Push to Talk" in settings
2. Hold the record button (or custom shortcut) while speaking
3. Release to stop and process
4. Text is automatically formatted and pasted

**Method 3: File Upload**
1. Click the file upload button
2. Select an audio file
3. Wait for transcription and formatting
4. Text is automatically pasted

### Searching Your Notes

- All transcriptions are automatically saved to a local database
- View recent transcriptions in the main window
- Search coming in Phase 2 with advanced filters

---

## Configuration

### Settings Panel

Access via the settings icon (⚙️) in the top-right corner:

- **OpenAI API Key**: Required for transcription and formatting
- **Toggle Shortcut**: Customize the keyboard shortcut (default: `Cmd+Shift+Space`)
- **Hold Shortcut**: Optional single-key shortcut for push-to-talk
- **Push to Talk Mode**: Toggle between click and hold-to-record

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+Space` (macOS) | Toggle recording |
| `Ctrl+Shift+Space` (Windows/Linux) | Toggle recording |
| Custom hold shortcut | Hold to record (if configured) |

---

## Testing

Comprehensive test suite with **70 tests** covering:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**
- ✅ DatabaseService: 75% coverage (32 tests)
- ✅ SearchService: 94% coverage (21 tests)
- ✅ Integration tests: Complete workflow coverage (17 tests)

---

## Privacy & Security

### What's Stored Locally
- ✅ Transcriptions (in local SQLite database)
- ✅ API key (in `~/.config/[app]/config.json`)
- ✅ Settings (in localStorage and config)
- ✅ Database backups (`.bak` file created on exit)

### What's Sent to OpenAI
- ⚠️ Audio recordings (for Whisper transcription)
- ⚠️ Transcribed text (for GPT-4o-mini formatting)

### What's NOT Collected
- ❌ No telemetry or analytics
- ❌ No cloud storage of transcriptions
- ❌ No account registration required
- ❌ No data sharing with third parties

### Security Features
- Local-only storage (never leaves your computer except for API calls)
- API key validation before saving
- Database auto-backup on exit
- Optional database encryption (planned for Phase 2)

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

- ✅ Verify your key starts with `sk-`
- ✅ Check you have sufficient API credits at [OpenAI Platform](https://platform.openai.com/account/usage)
- ✅ Ensure the key has access to Whisper and GPT-4o-mini models
- ✅ Try re-entering the key in Settings

### Database Issues

- Database is stored at: `~/.config/[app]/data/transcriptions.db`
- Backup file: `~/.config/[app]/data/transcriptions.db.bak`
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
│   ├── main.ts                 # Electron main process
│   ├── preload.ts             # IPC bridge
│   ├── renderer/              # React UI
│   │   ├── App.tsx           # Main component
│   │   ├── Overlay.tsx       # Waveform overlay
│   │   └── styles.css        # Styling
│   ├── services/             # Business logic
│   │   ├── database.ts       # SQLite + FTS5
│   │   ├── search.ts         # Search service
│   │   ├── transcription.ts  # Whisper API
│   │   ├── formatter.ts      # GPT-4o-mini formatting
│   │   ├── paste.ts          # Cross-platform paste
│   │   └── config.ts         # Config management
│   └── __tests__/            # Test files
├── FEATURES.md               # Complete feature documentation
├── jest.config.js            # Jest configuration
├── package.json              # Dependencies
└── README.md                 # This file
```

### Tech Stack

| Technology | Purpose |
|------------|---------|
| **Electron 27** | Desktop application framework |
| **React 18** | UI components |
| **TypeScript 5.3** | Type-safe JavaScript |
| **Vite 5** | Fast build tool |
| **SQLite** (better-sqlite3) | Local database with FTS5 |
| **OpenAI API** | Whisper + GPT-4o-mini |
| **uiohook-napi** | Global keyboard shortcuts |
| **Jest** | Testing framework |

### Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build:main       # Build main process
npm run build:renderer   # Build renderer process
npm run build           # Build both

# Testing
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Production
npm start               # Start the app
npm run dist            # Build distributable packages
```

### Adding New Features

1. Read [FEATURES.md](FEATURES.md) for planned features
2. Create tests first (TDD approach)
3. Implement the feature
4. Ensure all tests pass (`npm test`)
5. Update documentation
6. Update [FEATURES.md](FEATURES.md) status

---

## Building for Distribution

Create installers for your platform:

```bash
npm run dist
```

Output will be in the `out/` directory:
- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` and `.deb` packages

---

## Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Persistent storage with SQLite
- [x] Full-text search with FTS5
- [x] Comprehensive test suite (70 tests)
- [x] Database integration
- [x] Auto-backup system

### 📋 Phase 2: Smart Formatting (Week 2)
- [ ] 5 formatting profiles
- [ ] Optional live preview
- [ ] Inline text editing
- [ ] Profile customization

### 📋 Phase 3: Workflow Flexibility (Week 3)
- [ ] Flexible paste modes
- [ ] Quick actions & shortcuts
- [ ] Intelligent tagging
- [ ] Tag management UI

### 📋 Phase 4: Recording Enhancements (Week 4)
- [ ] Pause/resume recording
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

- **Issues**: [GitHub Issues](https://github.com/your-username/speech-to-text-app/issues)
- **Documentation**: [FEATURES.md](FEATURES.md)
- **Tests**: Run `npm test` to verify functionality

---

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Powered by [OpenAI](https://openai.com/) (Whisper + GPT)
- Icons and UI inspired by modern design principles

---

**Version**: 1.0.0 (Phase 1 Complete)
**Last Updated**: 2025-11-30
