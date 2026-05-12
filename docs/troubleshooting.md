# Troubleshooting

> **This doc is a Plan D deliverable.** A full symptom-keyed punch list for the Tauri-era app lands in Plan D (Section 13 of the release-pipeline plan). Until then, use the pointers below.

Closest equivalents for common issues:

- **macOS permission issues** (Microphone / Accessibility / Input Monitoring prompts not showing, stale denials) — see [`permissions.md`](./permissions.md) and the `/reset-perms` slash command.
- **Provider HTTP failures** (401, 429, network) — check the relevant provider's docs URL inside `packages/desktop/src/providers/<provider>.ts`; deprecated model ids are aliased automatically (see `assemblyai.ts` and `groq.ts`).
- **Packaged-build smoke test** — `/diagnose` (read-only).
- **Hotkey doesn't fire** — on macOS, Input Monitoring must be granted for the Fn-key tap; for standard combos, check Accessibility is granted (paste step). See [`permissions.md`](./permissions.md).
- **Onboarding screen keeps appearing** — `vox-era-onboarding.bin` in the app's data dir tracks the completed flag; deleting it resets onboarding.
- **Build refuses to start** — the live `config.json` at the repo root is for the legacy Electron app only and has no role in the Tauri build. Vox Era reads API keys from the OS keychain via the in-app Settings → API Keys flow.

Legacy (Electron-era) troubleshooting for the archived Ada app lives under `legacy/electron/README.md`.
