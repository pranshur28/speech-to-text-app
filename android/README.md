# Speech Keyboard for Android

A native English QWERTY keyboard with optional Deepgram streaming dictation. Android 8.0 (API 26) and newer. This is the first Android implementation, alongside the Electron desktop app.

## First version

- Minimal dark keys with a pressed highlight, character previews, optional system haptics, Shift/double-tap Caps Lock, and repeating Backspace.
- Numbers/punctuation, currency/typography, and mathematics pages; long-press letter shortcuts show their alternate symbols in the key corner.
- AndroidX emoji picker with categories, locally saved recents, and long-press variants. Backspace removes complete emoji clusters.
- URL/email characters including `.`, `/`, `@`, `:`, `-`, and `_`.
- Enter or the destination field's Go/Search/Send/Next/Done action.
- A globe button for returning to another installed keyboard.
- Mic/Stop controls with Flux or Nova-3, using 16 kHz mono PCM over a secure WebSocket.
- Partial transcripts use Android composing text; final phrases are committed in place.
- Recording stops when typing begins, the cursor moves, the keyboard hides, the field changes, or configuration changes (including folding/rotation).
- Voice input is disabled for standard password fields. No transcript history, analytics, or typing telemetry.
- Your own Deepgram API key is encrypted using an Android Keystore-backed AES-GCM key. App backup is disabled.

The layout resizes to the available width, including a Samsung Z Fold cover or inner display. Automatic split mode adds a center gap and a space key on each side on wide/landscape screens. Settings also offer forced split on wide screens or no split. Fold/rotation behavior and physical haptics still need device testing.

Not included yet: autocorrect, word suggestions, swipe typing, other languages, dictionary replacements, voice commands, desktop synchronization, or saved transcript history. This is not full Gboard/SwiftKey feature parity.

## Updating without losing your API key

Install the new APK **over the installed app**. Do not uninstall it or clear its app data. The application ID remains `com.speechtotext.keyboard`, and updates must use the original signing key. Existing encrypted preferences and the Android Keystore alias are retained; changing keyboard preferences does not overwrite the saved key. The setup screen shows whether a key is saved without exposing it.

Your Deepgram API key itself is reusable across versions. Even if app data is removed, you can enter the same valid key again; generating a fresh provider key is not required.

The initial debug APK certificate SHA-256 is `18f90aec21b6ca554df43676b0a22d107df760798f59ff979681f3b4680972cd`. Keep the developer machine's `.android\debug.keystore` for these test updates; do not commit it. Check future APKs with `apksigner verify --print-certs` before distributing an update.

## Build and checks (PowerShell)

Open the `android` folder in Android Studio, or use the commands below. Use Android Studio's Java runtime instead of an older Java installation on PATH.

```powershell
Set-Location C:\Users\prans\speech-to-text-app\android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Toolchain: Android Gradle Plugin 9.4.1 (built-in Kotlin), Gradle 9.8.1, compile/target SDK 36, build tools 36.0.0, JDK 17 or newer. The Gradle wrapper pins the Gradle version. Android Studio can install a missing Android SDK Platform 36.

APK: `app\build\outputs\apk\debug\app-debug.apk`. A debug APK is for local testing; public distribution requires a release signing configuration and distribution review.

## Install and test on your phone

Enable Developer options and USB debugging on the phone. Connect it with USB and approve its debugging prompt. Run these commands yourself when ready:

```powershell
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb devices
& $adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

If multiple devices appear, add `-s DEVICE_SERIAL` before `install`.

1. Open **Speech Keyboard** from the phone's launcher.
2. Enter your Deepgram API key, save it, choose a model, and allow microphone access.
3. Tap **Enable keyboard in Android settings**, then enable **Speech Keyboard**. Android displays its standard third-party-keyboard warning.
4. Tap **Choose keyboard** and select **Speech Keyboard**.
5. Use the test field in the setup screen. Type first, then try Mic and Stop. No audio is recorded just by selecting the keyboard.
6. Use the globe button to return to Samsung Keyboard or Gboard whenever needed.

## Physical-device checklist

- Type a URL such as `https://example.com/path?q=hello_world` in a browser and an email address in a message.
- Verify Shift, Caps Lock, all three symbol/math pages, selection deletion, held Backspace, numeric fields, and the editor action key.
- Verify press highlighting, character previews, long-press symbols, and haptics (phone touch vibration must be enabled).
- Try `!"#$%&'()*+,-./:;<=>?@[\]^_` plus braces, pipe, tilde, and backtick. Visit **?123 → #+= → Math** for `± × ÷ ≠ ≈ ≤ ≥ ∞ √ π ∑ ∫`.
- Open **☺**, browse categories, hold for skin-tone/other variants, and check that Backspace removes an entire joined emoji.
- In landscape and unfolded modes, verify the center gap and both space keys. Try the split-layout preference too.
- Install the update over the old APK and confirm **API key: saved** before testing the microphone.
- Test ordinary typing with airplane mode enabled. Dictation needs internet access and Deepgram account credit.
- Dictate multiple phrases; stop during speech; verify the final phrase is retained.
- Move the cursor or start typing during dictation. Verify late results do not change the new cursor position.
- Hide/switch the keyboard, switch apps/fields, rotate, and fold/unfold during dictation. Verify the microphone indicator clears and no text leaks into another field.
- Verify Mic is disabled in password fields and that no transcript/credential is written to logs.
- Test your actual browser, messaging and notes apps; editors can implement composing text differently.
- Test denied microphone permission, an invalid key, loss of connectivity, and a slow connection. Retry must require tapping Mic.
- Test Bluetooth audio separately; there is no explicit Bluetooth route selector in this version.

## Design

`SpeechKeyboardService` owns editor state and the keyboard UI. `DictationSession` owns one audio/socket lifetime. Generation IDs discard callbacks from cancelled sessions. `DeepgramProtocol` normalizes provider events. `EditorPolicy` handles password/numeric fields and action labels. `SetupActivity` handles permissions, key entry, model choice, and keyboard setup.

Audio goes directly from the phone to Deepgram only during an explicitly started session. The app sends no ordinary keystrokes or surrounding field text to Deepgram. Provisional text already inserted is kept if a session is interrupted; starting to type finalizes it before inserting your key.

Tests cover provider parsing, audio parameters, password/editor policies, complete ASCII punctuation coverage, symbol insertion, press feedback, haptic calls, split layouts, emoji grapheme deletion, native picker construction, and preference preservation. UI tests use Robolectric; they do not establish physical haptics, on-device microphone behavior, or third-party editor compatibility. Use the checklist above.
