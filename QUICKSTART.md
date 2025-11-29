# Quick Start Guide

## 1. Get Your OpenAI API Key

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

3. Edit `.env` and paste your OpenAI API key:
```
OPENAI_API_KEY=sk-your-key-here
```

## 3. Run the App

### Development Mode (with hot reload)
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

## 4. Using the App

### Push-to-Talk Mode (Recommended)
- Hold the **spacebar** while speaking
- Release to transcribe and format

### Continuous Mode
- Click "Start Recording"
- Speak freely
- Click "Stop Recording"
- The text will be automatically formatted and pasted

### File Upload Mode
- Click "Choose Audio File"
- Select an MP3, WAV, FLAC, or other audio file
- The app will transcribe it

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

### API Key Issues
- Verify your key is correct (starts with `sk-`)
- Check you have API credits at https://platform.openai.com/account/billing/overview
- Ensure the key has access to Whisper and Claude models

### Pasting Not Working
- Grant accessibility permissions:
  - macOS: System Preferences → Security & Privacy → Accessibility
  - Windows: Settings → Privacy & Security → Accessibility

## Next Steps

1. **Customize Formatting**: Edit `src/services/formatter.ts` to change how text is formatted
2. **Build for Distribution**: Run `npm run dist` to create installer files
3. **Add Languages**: Modify the Whisper configuration in `src/services/transcription.ts`

## File Structure

```
speech-to-text-app/
├── src/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts              # Secure bridge between processes
│   ├── services/
│   │   ├── transcription.ts    # OpenAI Whisper integration
│   │   ├── formatter.ts        # GPT formatting logic
│   │   └── paste.ts            # Text pasting to active window
│   └── renderer/
│       ├── App.tsx             # Main React component
│       ├── components/
│       │   ├── RecordingPanel.tsx
│       │   ├── TranscriptionDisplay.tsx
│       │   └── SettingsPanel.tsx
│       ├── styles.css
│       ├── index.tsx
│       └── index.html
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment variables template
└── README.md
```

## Support

For issues or questions:
1. Check the README.md for more detailed documentation
2. Verify your OpenAI API key is valid
3. Check system permissions for microphone and accessibility
