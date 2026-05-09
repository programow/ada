# `@vox-era/desktop`

The Vox Era desktop app: Tauri 2 (Rust core) + React 18 + Vite + TypeScript (webview).

This package is one of the workspaces under `/packages/`; the monorepo also has `landing` (Plan C) and `infra` (Plan D). For repo-wide context, start at the [root README](../../README.md) and the [docs index](../../docs/README.md).

## Layout

```
packages/desktop/
  src/                React + TS (webview)
    main.tsx          Mount point
    App.tsx           Window dispatcher (main vs overlay)
    lib/              invoke wrapper, transcribe orchestration
    providers/        9 STT provider adapters + types + registry
    components/ui/    shadcn-neobrutalism primitives
    windows/
      main/           Dashboard, History, Settings tabs
      overlay/        Transparent recording overlay
  src-tauri/          Rust core
    src/
      lib.rs          Crate entry, plugin wiring, command registration
      commands.rs     #[tauri::command] surface
      audio/          AudioSource trait, cpal impl, per-OS permissions
      secrets/        Vault trait, KeyringVault, redacted SecretKey
      history/        sqlx repo + stats + retention against the SQL plugin
      shortcut/       Hotkey manager + macOS Fn-key CGEventTap
      tray/           Tray icon + menu (programmatic, no PNG)
      clipboard/      Clipboard trait + in-memory impl
      paste/          Paster trait + EnigoPaster
      settings/       Settings struct + defaults (tauri-plugin-store)
    capabilities/     Tauri capability JSON (per-window plugin grants)
    migrations/       SQL migration files
    Cargo.toml
    tauri.conf.json
  tests/
    integration/      Cross-module flows
    functional/       End-to-end transcribe flow with MSW
    fixtures/audio/   Deterministic synthesized audio + regenerate.ts
  package.json
  vite.config.ts
  vitest.config.ts
  tsconfig.json
```

## The Rust / TS boundary

- The webview owns no privileged work. **All** OS access goes through Tauri commands.
- Every `#[tauri::command]` lives in `src-tauri/src/commands.rs` and has a typed mirror in `src/lib/invoke.ts`. If you add one without the other, you have a bug.
- Plugin capabilities are explicitly listed in `src-tauri/capabilities/default.json` — the webview can only invoke what's allowed there.

For a deeper walk-through, see [`docs/architecture.md`](../../docs/architecture.md).

## Run the dev app

```bash
bun install                   # at repo root
cd packages/desktop
bun run tauri:dev
```

Or use the slash command: `/dev-desktop`.

Vite serves the React side on `http://localhost:1420`; Tauri compiles the Rust core in debug mode and opens both the main window and the overlay. Hot reload works for the webview side; saving a Rust file triggers a cargo recompile.

First Rust build is slow (30–90s); subsequent incremental builds are seconds.

## Run the tests

Four layers (per [`docs/testing.md`](../../docs/testing.md)):

```bash
# Vitest (TS) — unit + integration + functional
bun run test
bun run test:unit             # fastest — unit only
bun run test:integration
bun run test:functional

# Rust
cd src-tauri && cargo test --lib
```

Or the slash commands: `/test`, `/test-fast`, `/coverage`.

## Add an STT provider

Use `/add-provider <id> <Name>` — the slash command walks through every step (adapter file, registry entry, contract test, logo, docs). For the principles, see [`docs/providers.md`](../../docs/providers.md).

## Tracked Tauri plugins

| Plugin | Why |
|---|---|
| `tauri-plugin-clipboard-manager` | Read/write the OS clipboard. Used by `EnigoPaster`. |
| `tauri-plugin-global-shortcut` | Cross-platform hotkeys (the `Standard` `HotkeyCombo`). |
| `tauri-plugin-sql` (sqlite) | Persist transcription history. Migrations registered in `history/mod.rs`. |
| `tauri-plugin-store` | Persist settings (active provider, model, theme, etc.). |
| `tauri-plugin-updater` | Auto-update; minisign keypair wired in Plan D. |

Capability grants for each are listed in `src-tauri/capabilities/default.json`.

## Configuration

- `tauri.conf.json` — bundle id (`com.programow.voxera`), windows config (main + overlay), CSP allowlist (provider hostnames), bundle metadata, updater endpoint placeholder.
- `Cargo.toml` — Rust dependencies: `tauri`, `cpal`, `keyring`, `sqlx`, `enigo`, `objc2-av-foundation` on macOS, `windows` on Windows.
- `package.json` — `@ai-sdk/*` for each provider, `@tauri-apps/plugin-*` for each tracked plugin.

For secret storage, see [`docs/secrets.md`](../../docs/secrets.md). For permissions, see [`docs/permissions.md`](../../docs/permissions.md).

## Build a release locally

```bash
bun run tauri:build
```

or `/build-clean` for the full reset+build+install ritual on macOS.

Production signing, notarization, and update artifact generation are Plan D.
