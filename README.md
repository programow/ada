# Ada

A macOS desktop app that provides global speech-to-text. Press a
global shortcut to record audio, which is transcribed via OpenAI
Whisper API and pasted into the active application.

For architecture, build details, permissions, and troubleshooting,
see [`docs/`](docs/README.md).

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create `config.json` in the project root (schema in
   [`docs/whisper-integration.md`](docs/whisper-integration.md)):

   ```json
   {
     "openai_api_key": "sk-...",
     "model": "whisper-1"
   }
   ```

## Development

Run the app directly with Electron (inherits terminal permissions, no
signing needed):

```
npm start
```

Or, inside a Claude Code session, run `/dev` which adds a
`config.json` sanity check.

## Build & Install

The short version:

```
npm run build
cp -R dist/mac-arm64/Ada.app /Applications/Ada.app
codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app
```

For the full ritual (with TCC reset and the *why* behind each step),
see [`docs/build-and-release.md`](docs/build-and-release.md). Inside
a Claude Code session, run `/build-clean` to do all of it
automatically.

## Usage

- **Ctrl+Shift+Space** — Toggle recording.
- The app lives in the system tray. Right-click the tray icon to open
  the dashboard or quit.

## Platform

macOS-only. Requires Accessibility and Microphone permissions — see
[`docs/permissions.md`](docs/permissions.md).
