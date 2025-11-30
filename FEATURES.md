# Speech-to-Text App - Feature Documentation

## Overview
A powerful, polished note-taking companion that transforms speech into searchable, organized, and beautifully formatted text.

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
- **Toggle mode**: Click button to start/stop recording
- **Push-to-Talk mode**: Hold button while speaking
- **File upload**: Transcribe existing audio files (mp3, wav, flac, ogg, aac, m4a)
- **OpenAI Whisper API** for high-accuracy transcription
- **GPT-4o-mini** for intelligent text formatting
  - Automatic punctuation and capitalization
  - Paragraph breaks
  - Filler word removal (um, uh, etc.)

### ✅ Global Shortcuts
**Status**: Implemented & Tested

- **Customizable toggle shortcut**: Default `Command+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux)
- **Customizable hold shortcut**: Assign any single key for continuous recording
- **Works even when app is not in focus** using uiohook-napi
- **Visual shortcut recorder** with modifier key detection
- **Warning system** for common keys that might interfere with typing

### ✅ Visual Feedback
**Status**: Implemented & Tested

- **Audio visualization overlay** during recording
  - 16 animated bars responding to audio volume
  - Real-time waveform display
  - Bottom-center screen positioning
  - Click-through design (doesn't steal focus)
- **Status indicators**: Ready, Listening, Thinking, Formatting, Pasting, Done
- **Ripple animations** on record button
- **Color-coded states** for visual clarity

### ✅ Workflow Automation
**Status**: Implemented & Tested

- **Auto-paste** formatted text directly into any application
- **Cross-platform paste support** (macOS, Windows, Linux)
- **Recent transcriptions history** (last 20 shown in UI)
- **Background operation** with system tray icon
- **Minimize to tray** instead of quit

### ✅ Persistent Storage & Search (Phase 1 - Complete)
**Status**: Implemented & Tested (70 tests passing)

- **SQLite database** with FTS5 full-text search
- **Automatic save** of all transcriptions
- **Data persists** across app restarts
- **Auto-backup** on app exit (creates .bak file)
- **Search capabilities**:
  - Full-text search across all notes
  - Search in both raw and formatted text
  - Results ranked by relevance
  - Filter by favorite status
  - Filter by date range
  - Pagination support
- **Export functionality**:
  - Export to JSON (full data)
  - Export to Markdown (formatted)
  - Export to plain text
- **Statistics tracking**:
  - Total transcriptions count
  - Favorites count
  - Total tags count

### ✅ Configuration & Settings
**Status**: Implemented & Tested

- **OpenAI API key management**
  - Secure local storage (not in cloud)
  - Validation on save
  - Error messages for invalid keys
- **Push-to-Talk toggle**
  - Persisted in localStorage
  - Changes button behavior
- **Settings modal** with dark glass effect
- **Keyboard shortcut customization**

---

## Planned Features (Phase 2-4)

### 📋 Smart Formatting Profiles & Optional Live Preview
**Status**: Planned - Phase 2
**Implementation Timeline**: Week 2

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
- Store profiles in database
- Extend TextFormatter service
- Config preference for preview enable/disable
- Response format: JSON with formatted text + suggested tags

**Test Coverage Required:**
- Profile switching
- Preview modal interactions
- Bypass functionality
- Tag suggestion accuracy

---

### 📋 Flexible Paste Modes & Quick Actions
**Status**: Planned - Phase 3
**Implementation Timeline**: Week 3

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
- **Paste history** (last 10 pastes)

**Technical Details:**
- Extend PasteService with modes
- Create NotificationService for toasts
- Store paste history in database
- Settings UI for default paste mode and delay

**Test Coverage Required:**
- All paste modes
- Quick action shortcuts
- Paste verification
- Notification display

---

### 📋 Intelligent Tagging & Auto-Organization
**Status**: Planned - Phase 3
**Implementation Timeline**: Week 3

**Manual Tagging:**
- **Tag input** in live preview modal
- **Tag autocomplete**: Suggests existing tags as you type
- **Tag colors** auto-assigned from perceptually distinct palette (16 colors)
- **Quick tag shortcuts**: Common tags (work, personal, meeting, idea)

**Hybrid Auto-Tagging:**
- **AI suggests 2-5 tags** based on content (GPT-4o-mini)
- **Suggestions appear as "pills"** in live preview
- **User actions**:
  - Accept all (click checkmark)
  - Accept individual tags (click pill)
  - Reject all (click X)
  - Add custom tags (type in input)
- **Only runs when live preview is shown** (no extra cost if bypassed)

**Tag Browser:**
- **Sidebar panel** showing all tags with counts
- **Click tag to filter** notes
- **Tag management**: Rename, merge, delete, change color
- **Tag analytics**: Most used, recently used, trending

**Search Integration:**
- **Filter by tags**: `tag:meeting` or `#meeting`
- **Combine with text search**: `budget tag:meeting`
- **Multiple tags**: `tag:meeting tag:urgent` (AND logic)

**Technical Details:**
- Tags table with use_count
- Note-tag junction table
- TagService for CRUD operations
- Extend formatter to return suggested tags
- Tag autocomplete with fuzzy matching

**Test Coverage Required:**
- Tag creation and association
- Auto-tagging accuracy
- Tag search filters
- Tag management operations

---

### 📋 Pause/Resume Recording & Silence Detection
**Status**: Planned - Phase 4
**Implementation Timeline**: Week 4

**Pause/Resume:**
- **Click record button again to pause** (or dedicated pause icon)
- **Overlay changes state**: Red (recording) → Yellow (paused)
- **Resume by clicking again**
- **Audio recording continues seamlessly** (single file)
- **Keyboard shortcut**: Space bar toggles pause/resume (when app focused)

**Auto-Stop on Silence:**
- **Configurable threshold** in settings (3s, 5s, 10s, never)
- **Visual countdown** in overlay: "Stopping in 3... 2... 1..."
- **Cancel countdown** by speaking or clicking overlay
- **Auto-stop** when countdown completes

**Silence Warning:**
- **Modal if entire recording was silent**: "No speech detected. Recording may be empty."
- **Options**: "Transcribe Anyway" or "Discard"

**Technical Details:**
- RecordingState type: 'idle' | 'recording' | 'paused' | 'processing'
- Silence detection using audio analyzer
- Overlay countdown display
- Settings for silence threshold

**Test Coverage Required:**
- Pause/resume seamless operation
- Silence detection accuracy
- Countdown functionality
- Empty recording handling

---

### 📋 Search UI Components
**Status**: Planned - Phase 2
**Implementation Timeline**: Week 1 (Phase 2)

**SearchBar Component:**
- **Live search** with debounced input (300ms)
- **Search-as-you-type** with instant results
- **Keyboard shortcuts**: `Cmd+F` to focus search
- **Clear button** to reset search
- **Filter indicators** showing active filters

**NoteList Component:**
- **Virtual scrolling** for performance (react-window)
- **Displays last 20 by default** (or search results)
- **Each note shows**:
  - Timestamp (relative: "2 minutes ago" or absolute)
  - Formatted text preview (truncated)
  - Tags (if any)
  - Favorite indicator
- **Click to open detail modal**
- **Hover actions**: Re-paste, favorite, delete

**NoteDetail Modal:**
- **Full note display** with:
  - Raw text (expandable)
  - Formatted text
  - Timestamp
  - Tags (editable)
  - Favorite toggle
- **Actions**:
  - Re-paste to active app
  - Copy to clipboard
  - Export (JSON/Markdown/TXT)
  - Delete (with confirmation)
  - Edit formatted text
- **Keyboard navigation**: Arrow keys for prev/next note

**FilterPanel Component:**
- **Date range picker**
- **Favorites filter toggle**
- **Tag filter** (select from existing tags)
- **Clear all filters** button

**Technical Details:**
- Integrate with existing SearchService
- Use dbSearch IPC method
- Virtual scrolling for 10,000+ notes
- Keyboard accessibility

**Test Coverage Required:**
- Search input debouncing
- Virtual scrolling performance
- Filter application
- Keyboard navigation

---

## Future Enhancements (Post-Launch)

### 💡 Advanced AI Features

**Speaker Diarization:**
- Identify and label different speakers
- Format multi-person conversations
- Speaker color-coding

**Sentiment Analysis:**
- Detect tone/emotion in speech
- Visual indicators for mood
- Filter by sentiment

**Key Points Extraction:**
- Auto-highlight main ideas
- Summary generation for long transcriptions
- TL;DR mode

**Q&A Mode:**
- Ask questions about transcriptions
- Search across all notes with AI understanding
- Contextual answers

**Meeting Minutes:**
- Auto-generate structured meeting notes
- Identify action items and owners
- Extract deadlines and commitments

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

**App-Specific Behavior:**
- Different actions based on active application
- Custom formatting per app
- Integration detection

**Webhooks/API:**
- Send transcriptions to custom endpoints
- Zapier integration
- REST API for external access

**Direct Integrations:**
- **Obsidian**: Create notes directly
- **Notion**: Add to databases
- **Roam Research**: Daily notes integration
- **Slack/Discord**: Post to channels
- **Email clients**: Draft emails
- **Calendar apps**: Create events

**Auto-Tagging by Content:**
- AI-generated tags based on content analysis
- Smart categorization
- Topic detection

**Action Item Detection:**
- Parse and extract TODOs
- Identify deadlines
- Extract names and assignments
- Create tasks in external systems

---

### 💡 UI/UX Enhancements

**Themes:**
- Light mode
- Multiple color schemes
- Custom theme creation
- High contrast mode

**Customizable Layout:**
- Resizable panels
- Hide/show sections
- Custom sidebar width
- Remember layout preferences

**Real-Time Transcription Preview:**
- See words appear as you speak (streaming)
- Live correction suggestions
- Confidence indicators during recording

**Mini Mode:**
- Compact floating window
- Always-on-top option
- Minimal interface for focus

**Keyboard Shortcuts:**
- Full keyboard navigation
- Customizable shortcut mapping
- Chord support (e.g., `Cmd+K, Cmd+S`)
- Shortcut cheat sheet (?)

**Accessibility:**
- Screen reader support (ARIA labels)
- Keyboard-only operation
- Font size controls
- Reduced motion option
- Focus indicators

**Tutorial/Onboarding:**
- First-run guide
- Interactive tutorial
- Tooltips for new features
- Getting started checklist

---

### 💡 Advanced Recording Features

**Multi-Audio Sources:**
- Select different input devices
- System audio capture
- Multiple microphone support
- Audio mixing

**Background Noise Detection:**
- Warn when ambient noise is too high
- Suggest quieter environment
- Noise gate configuration

**Recording Timer:**
- Show elapsed time during recording
- Set max duration limits
- Time-based auto-save

**Audio Quality Presets:**
- Balance quality vs file size
- Bandwidth optimization
- Low/Medium/High quality options

**Batch File Processing:**
- Drag-drop multiple files at once
- Queue processing
- Progress indicators

---

### 💡 Collaboration & Sharing

**Cloud Sync:**
- Sync history across devices
- End-to-end encryption
- Conflict resolution
- Selective sync

**Share Links:**
- Generate shareable links to transcriptions
- Password protection
- Expiration dates
- View tracking

**Collaborative Editing:**
- Multiple users editing same transcription
- Real-time synchronization
- Presence indicators
- Change tracking

**Comments/Annotations:**
- Add notes to specific parts
- Thread discussions
- @mentions
- Resolve comments

**Version History:**
- Track changes over time
- Restore previous versions
- Compare versions
- Blame/attribution

**Team Workspaces:**
- Shared folders for teams
- Permission management
- Team templates
- Usage analytics

---

### 💡 Analytics & Insights

**Usage Statistics:**
- Words transcribed per day/week/month
- Time saved vs manual typing
- Most used features
- Recording duration trends

**Speaking Analytics:**
- Speaking pace (words per minute)
- Filler word frequency
- Vocabulary diversity
- Speaking time distribution

**Cost Dashboard:**
- Track API spending
- Budget alerts
- Cost per transcription
- Usage forecasts

**Productivity Metrics:**
- Daily/weekly transcription trends
- Peak productivity hours
- Most productive days
- Goal tracking

**Word Clouds:**
- Visual representation of frequent topics
- Tag frequency visualization
- Trend analysis
- Topic evolution over time

---

### 💡 Mobile & Cross-Platform

**Mobile Companion App:**
- iOS app for on-the-go recording
- Android app support
- Mobile-optimized UI
- Offline recording with later sync

**Browser Extension:**
- Transcribe in web browsers
- Capture from any webpage
- Integration with web apps
- YouTube/video transcription

**Watch Integration:**
- Start/stop recording from smartwatch
- Quick voice notes
- Complications/widgets
- Haptic feedback

**Cloud Backend:**
- Central processing server
- Sync across all devices
- Web dashboard
- API access

---

## Performance & Reliability

### ✅ Current Performance (Tested)
- **Database**: Handles 10,000+ notes efficiently
- **Search**: Results in <100ms
- **Insert**: 100 records in <5 seconds
- **Concurrent operations**: Safe multi-threaded access

### 📋 Planned Improvements
- **Offline Mode**: Local speech recognition fallback (Web Speech API or local Whisper)
- **Retry Logic**: Auto-retry failed API calls
- **Rate Limiting**: Queue requests when hitting API limits
- **Cost Tracking**: Monitor API usage and costs
- **Background Processing**: Continue working while transcription happens

---

## Security & Privacy

### ✅ Current Security
- **Local storage**: Transcriptions stored locally, never in cloud
- **API keys**: Stored in local config file (~/.config/[app]/config.json)
- **No tracking**: No analytics or telemetry
- **Audio**: Never cached locally (except for batch processing)

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
- **Database**: SQLite (better-sqlite3) with FTS5
- **AI Services**: OpenAI (Whisper + GPT-4o-mini)
- **Global Shortcuts**: uiohook-napi 1.5.4
- **Testing**: Jest + ts-jest

### Planned Additions
- **UI Library**: React Window (virtual scrolling)
- **State Management**: Context API (no Redux needed for now)
- **Notifications**: Electron Notification API + in-app toasts
- **Optional**: SQLCipher for encryption

---

## Success Metrics

### Phase 1 (Current - Complete)
✅ All transcriptions persisted to database
✅ Search returns results in <100ms for 10,000+ notes
✅ Database queries optimized (indexed, FTS5)
✅ Build compiles without errors
✅ 70 tests passing with good coverage

### Phase 2 (Search UI + Formatting)
- [ ] 5 formatting profiles working with distinct outputs
- [ ] Live preview optional (can be bypassed)
- [ ] Search UI responsive with virtual scrolling (10,000+ items)
- [ ] All keyboard shortcuts functional

### Phase 3 (Workflow + Tags)
- [ ] Tags applied with 80%+ relevance (auto-tagging)
- [ ] Paste modes all functional
- [ ] Quick actions working
- [ ] Toast notifications for all feedback

### Phase 4 (Recording + Polish)
- [ ] Pause/resume works seamlessly (single audio file)
- [ ] Silence detection prevents empty recordings
- [ ] Accessibility: Screen reader support, keyboard nav
- [ ] Export 1,000 notes in <5s

---

## Development Roadmap

### ✅ Phase 1: Foundation (Week 1) - **COMPLETE**
- [x] Install better-sqlite3 dependency
- [x] Create DatabaseService with schema and migrations
- [x] Create SearchService with FTS5 full-text search
- [x] Update save/load logic to use database
- [x] Integrate into main process with IPC handlers
- [x] Update preload.ts to expose database API
- [x] Update App.tsx to use database
- [x] Create comprehensive test suite (70 tests)
- [x] Verify all tests pass

### 📋 Phase 2: Smart Formatting (Week 2)
- [ ] Design 5 built-in profile prompts
- [ ] Implement profile system in TextFormatter
- [ ] Create ProfileSelector UI component
- [ ] Create LivePreview component with edit capability
- [ ] Add paste mode options
- [ ] Keyboard shortcuts (Enter, Esc, Cmd+E)
- [ ] Setting to enable/disable preview
- [ ] Tag extraction integration
- [ ] Test profile switching and accuracy

### 📋 Phase 3: Workflow Flexibility (Week 3)
- [ ] Extend PasteService with modes
- [ ] Add configurable paste delay setting
- [ ] Implement paste verification
- [ ] Create settings UI for paste defaults
- [ ] Keyboard shortcuts (Cmd+Shift+C/R/S)
- [ ] Implement paste history (last 10)
- [ ] Build Toast notification system
- [ ] Create tag schema and TagService
- [ ] Manual tagging UI with autocomplete
- [ ] Tag browser and management UI
- [ ] Hybrid suggestion system

### 📋 Phase 4: Recording Enhancements (Week 4)
- [ ] Implement pause/resume recording logic
- [ ] Update overlay for paused state
- [ ] Keyboard shortcut for toggle
- [ ] Add silence detection with configurable threshold
- [ ] Create countdown timer in overlay
- [ ] Settings UI for silence threshold
- [ ] Performance audit (10,000+ notes)
- [ ] Accessibility review
- [ ] Error handling polish
- [ ] Documentation and guides

---

## Notes

- **Philosophy**: Each feature must be deeply polished before moving to the next
- **Testing**: Every new feature gets comprehensive test coverage
- **UX First**: Features should feel native and intuitive
- **Performance**: App should remain fast with 10,000+ transcriptions
- **Backwards Compatible**: Updates shouldn't break existing functionality

---

## Contributing

When adding new features:
1. Add to this document under appropriate phase
2. Create tests before or during implementation
3. Update README.md with usage instructions
4. Ensure all tests pass
5. Document any breaking changes

---

**Last Updated**: 2025-11-30
**Current Version**: 1.0.0 (Phase 1 Complete)
