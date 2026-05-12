# Vox Era Documentation

Long-form docs for Vox Era. Most of these are written across Plans B and D as the relevant subsystems land.

## Architecture & internals

- [`architecture.md`](./architecture.md) — Process model, Tauri command surface, recording flow sequence diagram. **Written in Plan B.**
- [`testing.md`](./testing.md) — 4-layer testability architecture, mocking boundaries, audio fixtures. **Written in Plan B.**
- [`permissions.md`](./permissions.md) — Microphone + Accessibility (macOS Fn key) flow per platform. **Written in Plan B.**
- [`secrets.md`](./secrets.md) — Per-platform credential storage and threat model. **Written in Plan B.**
- [`providers.md`](./providers.md) — How to add a new STT provider. **Written in Plan B.**

## Build, release, deploy

- [`build-and-release.md`](./build-and-release.md) — Local build, signing, notarization, GPG, release workflow walkthrough. **Written in Plan D.**
- [`install-linux.md`](./install-linux.md) — Apt + dnf install instructions for end users. **Written in Plan D.**
- [`ci-cd.md`](./ci-cd.md) — GitHub Actions overview, branch protection, OIDC, secrets list. **Written in Plan D.**

## Operations & dev workflow

- [`troubleshooting.md`](./troubleshooting.md) — Symptom-keyed punch list. **Written in Plan D.**
- [`development-workflow.md`](./development-workflow.md) — When to use which slash command. **Written across Plans B and D.**

## Per-package READMEs

- [`../packages/desktop/README.md`](../packages/desktop/README.md) — Tauri app specifics. **Written in Plan B.**
- [`../packages/landing/README.md`](../packages/landing/README.md) — Next.js landing specifics. **Written in Plan C.**
- [`../packages/infra/README.md`](../packages/infra/README.md) — Pulumi IaC specifics (AWS + Cloudflare DNS). **Written in Plan D.**

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
