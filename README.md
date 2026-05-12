# Vox Era

Cross-platform speech-to-text desktop app. Press a global shortcut, dictate, get text pasted wherever your cursor is. Bring your own API key for any of 9 STT providers (OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, Fal, Gladia, Azure OpenAI, Rev.ai).

**Status:** in active migration from a legacy Electron build. The new Tauri-based app lives under `packages/desktop/` (in development — see Plan B).

## Install

*Available once the first signed release ships (Plan D).* For now, see `docs/build-and-release.md` for local build instructions.

- **macOS:** [Download DMG](https://vox-era.com) (signed + notarized)
- **Windows:** [Download installer](https://vox-era.com) (unsigned at v1; SmartScreen warning expected)
- **Linux:** AppImage, deb, or rpm — see `docs/install-linux.md`

## Why Vox Era

- **Bring your own key.** Your API keys live in your OS keychain. Audio goes only to the provider you chose. No Vox Era backend.
- **Multi-provider.** Pick the model that fits: OpenAI Whisper, Groq's distil-whisper, Deepgram Nova, AssemblyAI, ElevenLabs Scribe, and more.
- **Cross-platform.** macOS, Windows, Linux. Same shortcut. Same UX.
- **Open source (Apache 2.0).** Read the code. Verify the privacy story.

## Project layout

```
vox-era/
├── packages/
│   ├── desktop/      # Tauri app — see Plan B
│   └── landing/      # Next.js landing page — see Plan C
├── docs/             # Architecture, testing, permissions, secrets, build/release
├── legacy/electron/  # Original Ada Electron app — archived during migration, removed in Plan D
└── .claude/commands/ # Slash commands for AI-assisted development
```

## Documentation

- [`docs/`](./docs) — architecture, testing, permissions, secrets, CI/CD, troubleshooting
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to contribute, branching model, conventional commits
- [`CLAUDE.md`](./CLAUDE.md) — AI dev workflow guide

## License

Apache 2.0. See [`LICENSE`](./LICENSE).
