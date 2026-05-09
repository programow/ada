# Ada Documentation

Long-form documentation for Ada, the macOS speech-to-text desktop app.
The top-level [`README.md`](../README.md) is the quick-start; this folder
covers everything else.

## Contents

- [Architecture](architecture.md) — Electron multi-process model, IPC contract, end-to-end flow.
- [Build & Release](build-and-release.md) — The clean build & install ritual, with the *why* behind each step.
- [Permissions](permissions.md) — macOS Microphone and Accessibility grants, how they're requested, and how to check status.
- [Whisper Integration](whisper-integration.md) — How Ada talks to OpenAI Whisper: endpoint, multipart body, audio format chain, failure modes.
- [Troubleshooting](troubleshooting.md) — Symptom-keyed punch list for common breakage.
- [Development Workflow](development-workflow.md) — How the four project-local slash commands fit into a normal day of work.
