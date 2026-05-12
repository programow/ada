# Development Workflow

Vox Era ships project-local Claude Code slash commands under [`.claude/commands/`](../.claude/commands/). They automate the rituals this project would otherwise require you to remember and run by hand.

This doc lists what each command does and when to use it. The commands themselves are the source of truth for *how* — each one is a small markdown file with executable instructions.
Ada ships with four project-local Claude Code slash commands under
[`.claude/commands/`](../.claude/commands/). They automate the
rituals that this project would otherwise require you to remember
and run by hand.

## When to use which command

| You're doing… | Run | Why |
|---|---|---|
| Editing TS/Rust, want to see the change | `/dev-desktop` | Vite + Tauri dev server, hot reload for the webview, cargo recompile for the Rust core. |
| Running the full test suite before pushing | `/test` | Vitest (TS) + `cargo test --lib` (Rust). |
| Iterating on a single TS module — fastest feedback | `/test-fast` | Skips integration + functional + Rust. |
| Type-checking | `/typecheck` | `tsc --noEmit` across all workspaces. |
| Linting + formatting check | `/lint` | `biome check .`. Use `bun run lint:fix` to auto-fix. |
| Coverage report | `/coverage` | Vitest with `@vitest/coverage-v8`; HTML report in `packages/desktop/coverage/`. |
| Adding an STT provider | `/add-provider <id> <Name>` | Scaffolds adapter + registry entry + tests + docs. |
| Building + installing the packaged app | `/build-clean` | Full Tauri build, installs to `/Applications/Vox Era.app` on macOS. |
| Diagnosing a packaged-build problem | `/diagnose` | Read-only checks for entitlements, signature, runtime libs. |
| TCC prompts misbehaving on macOS | `/reset-perms` | `tccutil reset` for `com.vhtechnology.voxera`. macOS-only. |
| Auditing doc obligations on the current branch | `/sync-docs` | Walks the trigger table from `CONTRIBUTING.md`. |
| Editing JS/HTML, want to see the change | `/dev` | Inherits terminal permissions, no build needed. |
| Testing the packaged app behavior (entitlements, signing, dock, tray) | `/build-clean` | Only the packaged build exercises the real permission and signing pipeline. |
| TCC prompts misbehaving (no prompt, or you need to retest the prompt flow) | `/reset-perms` | Clears the cached decision so prompts re-fire. |
| Mic / paste / packaged build broken, don't know why yet | `/diagnose-mic` | Read-only. Tells you which of (missing app, missing entitlements, invalid signature, missing config) is the cause. |

## What each command does

- **`/dev`** — verifies `config.json` exists and has a real API key,
  then runs `npm start` in the foreground.
- **`/reset-perms`** — runs `tccutil reset` for both Microphone and
  Accessibility, scoped to `com.programow.ada`. Idempotent and
  non-destructive. Tells you to relaunch Ada.
- **`/build-clean`** — the full five-step ritual from
  [build-and-release.md](build-and-release.md): TCC reset, remove the
  installed app and `dist/`, build, copy, re-sign with entitlements.
  Asks for confirmation before `rm -rf`. Verifies entitlements after
  signing.
- **`/diagnose-mic`** — a read-only checklist. Confirms
  `/Applications/Ada.app` is present, entitlements are signed in, the
  signature is valid, the app is running, and `config.json` is well
  formed. Reports each as ✓ / ✗.

## When to bypass the slash commands

You shouldn't normally, but valid cases:

- **Iterating on a single Rust file** without the full Tauri shell: `cd packages/desktop/src-tauri && cargo build` (won't run the app, but compiles fast).
- **Reproducing a specific signing or capability bug:** you may want to run `tauri build` directly with extra `--verbose` flags. `/build-clean` won't let you skip steps.
- **Investigating TCC behavior with a non-Vox-Era bundle id:** `tccutil` by hand, since `/reset-perms` hardcodes `com.vhtechnology.voxera`.
- **Iterating on `main.js`** without rebuilding: just `npm start`.
  `/dev` does the same plus a sanity check, but if you've already
  validated the config, plain `npm start` is fine.
- **Reproducing a specific signing bug:** you may want to *omit* the
  `--deep` flag or the entitlements file to confirm a hypothesis.
  `/build-clean` won't let you skip those steps.
- **Investigating TCC behavior with a non-Ada bundle id:** `tccutil`
  by hand, since `/reset-perms` hardcodes `com.programow.ada`.

## Adding a new command

Drop a new markdown file in `.claude/commands/<name>.md` with:

```markdown
---
description: One-line summary shown in the slash-command picker.
---

Body of the prompt that Claude executes when the user types /<name>.
Write it as instructions to Claude, not to the user.
```

Claude Code picks it up automatically on the next session.

The trigger table in `CONTRIBUTING.md` calls out new slash commands as a doc-update trigger — update the table above when you add one.
