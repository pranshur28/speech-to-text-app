# Speech-to-Text App - Feature Documentation

## Overview
A powerful, polished note-taking companion that transforms speech into searchable, organized, and beautifully formatted text — with real-time streaming transcription.

**Target Use Case**: General note-taking (capturing thoughts, ideas, TODOs throughout the day)

**Philosophy**: Deep polish on fewer features, maintaining app simplicity while adding power-user capabilities.

---

## Feature Status Legend
- ✅ **Implemented & Tested** - Feature is complete and has test coverage
- 🚧 **In Progress** - Feature is being implemented
- 📋 **Planned** - Feature is designed and ready for implementation
- 💡 **Future** - Feature is planned for post-launch

---

## Current Features (Implemented)

### ✅ Core Recording & Transcription
**Status**: Implemented & Tested

- **Real-time audio recording** from microphone
- **Toggle mode**: Click button or press shortcut to start/stop recording
- **Push-to-Talk mode**: Hold shortcut while speaking
- **Pause/Resume**: Pause recording mid-session and resume
- **File upload**: Transcribe existing audio files (mp3, wav, flac, ogg, aac, m4a)
- **Dual transcription engines**:
  - **Deepgram Nova-3**: Real-time streaming via WebSocket with interim results, smart formatting, and 300ms endpointing
  - **OpenAI Whisper**: Batch transcription for file uploads
- **GPT-4o-mini** for intelligent text formatting:
  - Automatic punctuation and capitalization
  - Paragraph breaks
  - Filler word removal (um, uh, etc.)
  - Mathematical notation support (Unicode symbols, Greek letters, superscripts, operators)

### ✅ Deepgram Streaming Transcription
**Status**: Implemented & Tested

- **WebSocket connection** to Deepgram Nova-3 model
- **Real-time interim results** displayed during recording
- **Final transcript accumulation** across the session
- **Smart formatting and punctuation** built into the stream
- **Keepalive mechanism** (5s interval) to prevent idle disconnections
- **Graceful shutdown** with 2s timeout for final results
- **Live paste**: Text is pasted as it streams in

### ✅ Custom Dictionary
**Status**: Implemented & Tested

- **Custom phrase replacements**: Define spoken phrase → replacement text mappings
- **Case sensitivity options**: Per-entry case-sensitive or case-insensitive matching
- **Enable/disable toggles**: Deactivate entries without deleting them
- **Automatic application**: Replacements applied after AI formatting
- **Longest-match-first ordering**: Prevents partial match conflicts
- **Settings UI**: Full CRUD interface with inline editing
- **Unique constraint**: Prevents duplicate spoken phrases

### ✅ Global Shortcuts
**Status**: Implemented & Tested

- **Customizable toggle shortcut**: Default `Command+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux)
- **Customizable hold shortcut**: Assign any key combination for continuous recording
- **Works even when app is not in focus** using uiohook-napi
- **Visual shortcut recorder** with modifier key detection
- **Warning system** for common keys that might interfere with typing
- **Paste mode**: Freezes key state during clipboard operations to prevent modifier corruption during push-to-talk
- **Globe/Fn key support** (keycode 179)

### ✅ Visual Feedback
**Status**: Implemented & Tested

- **Audio visualization overlay** during recording
  - 12 animated bars responding to audio volume
  - Color-coded intensity (green → yellow → red)
  - Bottom-center screen positioning
  - Click-through design (doesn't steal focus, hover to interact)
  - Pause/Resume and Stop buttons
- **Status indicators**: Ready, Starting, Recording, Paused, Processing
- **Ripple animations** on record button
- **Color-coded states** for visual clarity

### ✅ Workflow Automation
**Status**: Implemented & Tested

- **Auto-paste** formatted text directly into any application
- **Cross-platform paste support**:
  - Windows: Native keyboard simulation via @nut-tree-fork/nut-js
  - macOS: AppleScript + clipboard for Unicode support
  - Linux: xdotool if available
- **Paste mode**: Coordinates with ShortcutManager to track held modifiers and prevent key state corruption
- **Serialized paste queue**: Ensures paste operations never overlap
- **Recent transcriptions history** with virtual scrolling
- **Background operation** with system tray icon
- **Minimize to tray** instead of quit

### ✅ Persistent Storage & Search
**Status**: Implemented & Tested (~131 tests)

- **SQLite database** with FTS5 full-text search (schema v2)
- **Automatic save** of all transcriptions
- **Data persists** across app restarts
- **Auto-backup** on app exit (creates .bak file)
- **Search capabilities**:
  - Full-text search across all notes
  - Search in both raw and formatted text
  - Results ranked by relevance
  - Filter by favorite status
  - Filter by date range
  - Advanced query syntax: `tag:work`, `#meeting`, `fav:true`, `date:today|week|month`
  - Pagination support
- **Export functionality**:
  - Export to JSON (full data)
  - Export to Markdown (formatted)
  - Export to plain text
- **Statistics tracking**:
  - Total transcriptions count
  - Favorites count
  - Total tags count

### ✅ Search & Browse UI
**Status**: Implemented & Tested

- **SearchBar**: Debounced search (300ms) with special filter syntax parsing
- **NoteList**: Virtualized scrolling via react-window for 10,000+ notes
- **NoteCard**: Timestamp, formatted text preview, favorite indicator
- **NoteDetailModal**: Full view with re-paste, copy, delete, export actions
- **FilterPanel**: Date range, favorites, tag filters
- **Tab navigation**: Recording, History/Search, Settings tabs

### ✅ Configuration & Settings
**Status**: Implemented & Tested

- **OpenAI API key management** with validation
- **Deepgram API key management**
- **Push-to-Talk toggle** persisted in localStorage
- **Custom dictionary management** with inline editing UI
- **Keyboard shortcut customization** with real-time key detection
- **Settings stored** in `{userData}/config.json`

---

## Planned Features (Phase 2-4)

### 📋 Smart Formatting Profiles & Optional Live Preview
**Status**: Planned - Phase 2

**Formatting Profiles:**
- 5 built-in profiles:
  1. **Casual Notes** (default): Clean paragraphs, natural flow
  2. **Bullet Points**: Converts rambling to organized bullets
  3. **TODO List**: Extracts action items, formats as `- [ ] Task`
  4. **Meeting Notes**: Structured with sections (agenda, decisions, actions)
  5. **Code Comments**: Formatted for inline documentation
- **Profile selector** in main UI (dropdown near record button)
- **Profile icons** for quick visual identification
- **Custom profile creation** (edit system prompts)
- **Profile preference** saved per user

**Live Preview (Optional):**
- **Setting to enable/disable** (default: enabled for first-time users)
- **Preview modal** after transcription with:
  - Formatted text preview with syntax highlighting
  - Inline editor for quick corrections
  - Tag input with AI suggestions
  - Paste mode selector
  - Actions: "Paste Now" (Enter), "Copy Only", "Save Without Pasting", "Cancel" (Esc)
- **Can be bypassed** for quick dictation workflow
- **Keyboard shortcuts**: Enter (paste), Esc (cancel), Cmd+E (edit mode)
- **Toggle between raw and formatted** view
- **Smart profile suggestions**: Detect keywords → suggest appropriate profile

**Technical Details:**
- Store profiles in database (formatting_profiles table already exists)
- Extend TextFormatter service
- Config preference for preview enable/disable
- Response format: JSON with formatted text + suggested tags

---

### 📋 Flexible Paste Modes & Quick Actions
**Status**: Planned - Phase 3

**Paste Modes:**
1. **Paste Immediately**: Current behavior, auto-paste to active app
2. **Copy to Clipboard Only**: No auto-paste, just clipboard
3. **Save Without Pasting**: Store in history only

**Quick Actions (Keyboard Shortcuts):**
- `Cmd+Shift+C`: Copy last transcription to clipboard
- `Cmd+Shift+R`: Re-paste last transcription
- `Cmd+Shift+S`: Record and save without pasting
- `Cmd+Shift+V`: Open live preview for last transcription (if bypassed)

**Smart Paste Behavior:**
- **Configurable paste delay** (0-1000ms) for slow applications
- **Paste verification**: Check clipboard after paste to confirm success
- **Failure fallback**: If paste fails, notify user + keep in clipboard
- **Toast notifications** for all actions (top-right, auto-dismiss)
- **Paste history** (last 10 pastes, paste_history table already exists)

---

### 📋 Intelligent Tagging & Auto-Organization
**Status**: Planned - Phase 3

**Manual Tagging:**
- **Tag input** in live preview modal
- **Tag autocomplete**: Suggests existing tags as you type
- **Tag colors** auto-assigned from perceptually distinct palette (16 colors)
- **Quick tag shortcuts**: Common tags (work, personal, meeting, idea)

**Hybrid Auto-Tagging:**
- **AI suggests 2-5 tags** based on content (GPT-4o-mini)
- **Suggestions appear as "pills"** in live preview
- **Only runs when live preview is shown** (no extra cost if bypassed)

**Tag Browser:**
- **Sidebar panel** showing all tags with counts
- **Click tag to filter** notes
- **Tag management**: Rename, merge, delete, change color
- **Tag analytics**: Most used, recently used, trending

**Search Integration:**
- **Filter by tags**: `tag:meeting` or `#meeting` (already supported in search syntax)
- **Combine with text search**: `budget tag:meeting`
- **Multiple tags**: `tag:meeting tag:urgent` (AND logic)

**Technical Details:**
- Tags table with use_count (already in schema)
- Note-tag junction table (already in schema)
- TagService for CRUD operations
- Extend formatter to return suggested tags
- Tag autocomplete with fuzzy matching

---

### 📋 Pause/Resume Recording & Silence Detection
**Status**: Planned - Phase 4 (pause/resume UI already implemented)

**Silence Detection (Not yet implemented):**
- **Configurable threshold** in settings (3s, 5s, 10s, never)
- **Visual countdown** in overlay: "Stopping in 3... 2... 1..."
- **Cancel countdown** by speaking or clicking overlay
- **Auto-stop** when countdown completes

**Silence Warning:**
- **Modal if entire recording was silent**: "No speech detected. Recording may be empty."
- **Options**: "Transcribe Anyway" or "Discard"

---

## Future Enhancements (Post-Launch)

### 💡 Advanced AI Features

**Speaker Diarization:**
- Identify and label different speakers
- Format multi-person conversations
- Speaker color-coding

**Key Points Extraction:**
- Auto-highlight main ideas
- Summary generation for long transcriptions
- TL;DR mode

**Custom AI Instructions:**
- User-defined prompts for formatting
- Per-profile AI behavior
- Advanced formatting rules

---

### 💡 Productivity & Workflow Integration

**Voice Commands:**
- "Save this as note"
- "Send this as email"
- "Create calendar event"
- "Add to TODO list"

**Direct Integrations:**
- **Obsidian**: Create notes directly
- **Notion**: Add to databases
- **Slack/Discord**: Post to channels
- **Calendar apps**: Create events

---

### 💡 UI/UX Enhancements

**Themes:**
- Light mode
- Multiple color schemes
- High contrast mode

**Real-Time Transcription Preview:**
- See words appear as you speak (partially implemented via Deepgram interim results)
- Live correction suggestions

**Mini Mode:**
- Compact floating window
- Always-on-top option
- Minimal interface for focus

**Accessibility:**
- Screen reader support (ARIA labels)
- Keyboard-only operation
- Font size controls
- Reduced motion option

---

### 💡 Advanced Recording Features

**Multi-Audio Sources:**
- Select different input devices
- System audio capture

**Background Noise Detection:**
- Warn when ambient noise is too high
- Noise gate configuration

**Batch File Processing:**
- Drag-drop multiple files at once
- Queue processing
- Progress indicators

---

### 💡 Collaboration & Sharing

**Cloud Sync:**
- Sync history across devices
- End-to-end encryption

**Share Links:**
- Generate shareable links to transcriptions
- Password protection

---

### 💡 Analytics & Insights

**Usage Statistics:**
- Words transcribed per day/week/month
- Time saved vs manual typing

**Cost Dashboard:**
- Track API spending
- Budget alerts
- Cost per transcription

---

## Performance & Reliability

### ✅ Current Performance (Tested)
- **Database**: Handles 10,000+ notes efficiently
- **Search**: Results in <100ms
- **Insert**: 100 records in <5 seconds
- **Concurrent operations**: Safe multi-threaded access
- **Virtual scrolling**: 60fps rendering for large note lists
- **Deepgram streaming**: <300ms latency for interim results

### 📋 Planned Improvements
- **Offline Mode**: Local speech recognition fallback (Web Speech API or local Whisper)
- **Retry Logic**: Auto-retry failed API calls
- **Rate Limiting**: Queue requests when hitting API limits
- **Cost Tracking**: Monitor API usage and costs

---

## Security & Privacy

### ✅ Current Security
- **Local storage**: Transcriptions stored locally, never in cloud
- **API keys**: Stored in local config file (`{userData}/config.json`)
- **Context isolation**: Electron preload bridge with no `nodeIntegration`
- **No tracking**: No analytics or telemetry
- **Audio**: Streamed to Deepgram in real-time, not cached locally

### 📋 Planned Security
- **Database encryption**: SQLCipher for at-rest encryption
- **Secure backup**: Encrypted backups
- **Privacy mode**: No history, immediate deletion
- **Data export/deletion**: GDPR compliance tools

---

## Technical Architecture

### Current Stack
- **Framework**: Electron 27.0.0
- **Frontend**: React 18.2.0 + TypeScript 5.3.3
- **Build Tool**: Vite 5.0.8
- **Database**: SQLite (better-sqlite3 12.5.0) with FTS5, schema v2
- **Streaming Transcription**: Deepgram Nova-3 via WebSocket (ws 8.19.0)
- **Batch Transcription**: OpenAI Whisper
- **AI Formatting**: GPT-4o-mini (OpenAI 4.28.0)
- **Global Shortcuts**: uiohook-napi 1.5.4
- **Keyboard Simulation**: @nut-tree-fork/nut-js 4.2.6
- **UI Components**: Radix UI (checkbox, dialog, switch, tabs, tooltip, scroll-area, label)
- **Virtual Scrolling**: react-window 1.8.11
- **Testing**: Jest + ts-jest

### Database Schema (v2)
- `transcriptions` — Main notes (raw_text, formatted_text, timestamp, formatting_profile, is_favorite)
- `transcriptions_fts` — Full-text search index (FTS5)
- `tags` — Custom tags (name, color, use_count)
- `note_tags` — N:N junction table
- `formatting_profiles` — Custom formatting styles
- `paste_history` — Track when notes were pasted
- `dictionary_entries` — Custom phrase replacements
- `schema_version` — Migration tracking

---

## Success Metrics

### Phase 1 (Complete)
✅ All transcriptions persisted to database
✅ Search returns results in <100ms for 10,000+ notes
✅ Database queries optimized (indexed, FTS5)
✅ Build compiles without errors
✅ ~131 tests passing

### Deepgram Integration (Complete)
✅ Real-time streaming transcription with <300ms latency
✅ Interim + final results displayed in UI
✅ Live paste during recording session
✅ Graceful session management

### Dictionary & Paste (Complete)
✅ Custom phrase replacements with full CRUD
✅ Paste mode prevents modifier key corruption
✅ Windows EXE packaging works with native modules
✅ Serialized paste queue prevents race conditions

### Phase 2 (Planned)
- [ ] 5 formatting profiles working with distinct outputs
- [ ] Live preview optional (can be bypassed)
- [ ] All keyboard shortcuts functional

### Phase 3 (Planned)
- [ ] Tags applied with 80%+ relevance (auto-tagging)
- [ ] Paste modes all functional
- [ ] Toast notifications for all feedback

### Phase 4 (Planned)
- [ ] Silence detection prevents empty recordings
- [ ] Accessibility: Screen reader support, keyboard nav
- [ ] Export 1,000 notes in <5s

---

## Contributing

When adding new features:
1. Add to this document under appropriate phase
2. Create tests before or during implementation
3. Update README.md with usage instructions
4. Ensure all tests pass
5. Document any breaking changes

---

**Last Updated**: 2026-03-25
**Current Version**: 1.0.0
