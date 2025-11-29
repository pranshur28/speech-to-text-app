# Speech to Text Desktop App

A desktop application that lets you dictate to your computer with LLM-powered formatting. Record audio and get perfectly formatted text with proper punctuation, capitalization, and paragraph breaks.

## Features

- **Multiple Recording Modes**
  - Push-to-Talk: Hold spacebar to record
  - Continuous: Click button to start/stop
  - File Upload: Transcribe existing audio files

- **AI-Powered Transcription**
  - Uses OpenAI's Whisper API for accurate speech recognition
  - Supports multiple languages

- **Smart Formatting**
  - Adds proper punctuation and capitalization
  - Creates paragraph breaks
  - Organizes content logically
  - Removes filler words (um, uh, etc.)

- **Auto-Paste**
  - Formatted text automatically pastes to the active window
  - Works with any application

## Setup

### Prerequisites

- Node.js 16+ and npm
- macOS, Windows, or Linux
- An OpenAI API key

### Installation

1. Clone or download this project
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your OpenAI API key:
```bash
cp .env.example .env
# Then edit .env and add your API key
OPENAI_API_KEY=sk-your-key-here
```

Get your API key from [OpenAI's API keys page](https://platform.openai.com/api-keys)

### Running the App

Development mode (with hot reload):
```bash
npm run dev
```

Production build:
```bash
npm run dist
```

## Usage

1. **Choose a Recording Mode**
   - Select from Push-to-Talk, Continuous, or File Upload

2. **Record Your Speech**
   - Push-to-Talk: Hold spacebar while speaking
   - Continuous: Click "Start Recording" and speak, then click "Stop Recording"
   - File Upload: Select an audio file to transcribe

3. **Get Formatted Text**
   - The app transcribes your audio using Whisper
   - GPT formats the text with proper punctuation, capitalization, and structure
   - The formatted text automatically pastes into the active window

4. **Copy if Needed**
   - You can also copy the formatted text to your clipboard

## Configuration

### Settings

The app stores settings in browser localStorage. You can:
- Update your OpenAI API key
- View available features

## Privacy & Security

- Your API key is stored locally on your computer (in `.env`)
- Audio is sent to OpenAI's servers for transcription
- The formatting request is sent to OpenAI (using Claude)
- No data is stored persistently by this application
- Each session is independent

## Troubleshooting

### Microphone Access Denied
- Grant microphone permission when the app requests it
- On macOS: System Preferences → Security & Privacy → Microphone
- On Windows: Settings → Privacy & Security → Microphone

### Pasting Not Working
- Ensure the app has accessibility permissions
- On macOS: System Preferences → Security & Privacy → Accessibility
- Click "Allow" for the app to control your computer

### API Key Errors
- Verify your OpenAI API key is correct
- Check you have sufficient API credits
- Make sure the key has access to Whisper and GPT models

## Building for Distribution

To build a packaged application:
```bash
npm run dist
```

This creates installer files for your platform in the `out/` directory.

## Technology Stack

- **Electron**: Desktop application framework
- **React**: UI components
- **TypeScript**: Type-safe JavaScript
- **OpenAI API**: Whisper (transcription) + Claude (formatting)
- **robotjs**: Text pasting and keyboard simulation

## License

This project is open source and available under the MIT License.
