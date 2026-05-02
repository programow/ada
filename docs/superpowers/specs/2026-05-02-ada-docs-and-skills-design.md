# Ada — Documentation & AI Workflow Design

**Date:** 2026-05-02
**Status:** Approved (pending written-spec review)
**Author:** Guilherme Vozniak

## Goal

Give Ada a documentation set that explains its structure and features, plus a set of project-local Claude Code slash commands that automate the rituals contributors run by hand today.

## Why now

The project has two commits, a single author, and no formal docs beyond `README.md` (quick-start) and `CLAUDE.md` (Claude-facing notes). The build/install ritual is non-trivial — re-signing with entitlements is required and easy to forget. As contributors (human or AI) come in, repeating that ritual without automation is a reliability liability. Documentation captures the *why* behind each step; slash commands capture the *how* so the steps run identically every time.

## Out of scope

- Tests / CI / lint setup. The project has none today; introducing them is a separate effort.
- An `/add-shortcut` or `/release` slash command. YAGNI until the need actually shows up.
- Hooks in `settings.json`. None of the planned commands need to fire automatically.
- Custom agents/subagents. The commands are short enough that the main thread handles them.
- A curated `.claude/settings.json` permissions allowlist. Add only if prompts get noisy.
- Code changes to `main.js`, `renderer.js`, `preload.js`, etc. This work is documentation + tooling only.

## Architecture

Two additions, both new directories at the repo root:

```
ada/
├── docs/                       # NEW — long-form documentation
│   ├── README.md
│   ├── architecture.md
│   ├── build-and-release.md
│   ├── permissions.md
│   ├── whisper-integration.md
│   ├── troubleshooting.md
│   └── development-workflow.md
└── .claude/                    # NEW — project-local Claude Code automation
    └── commands/
        ├── build-clean.md
        ├── reset-perms.md
        ├── dev.md
        └── diagnose-mic.md
```

The top-level `README.md` stays as a quick-start and gains a "For deeper docs see `docs/`" pointer. `CLAUDE.md` keeps its high-level summary but the "Clean Build & Install Ritual" section shrinks to a one-line link to `docs/build-and-release.md` and a note that `/build-clean` automates it. This avoids duplicating the ritual in three places.

## Documentation set

### `docs/README.md` — index

One-paragraph orientation plus a linked table of contents to the other six documents. Names what each doc is for so readers can jump directly.

### `docs/architecture.md`

Describes the Electron multi-process model and the end-to-end flow.

Contents:
- Process roles: main, renderer, preload, with one-paragraph each.
- File-by-file map: `main.js`, `renderer.js`, `preload.js`, `index.html`, `dashboard.html`, `paste-helper.swift`, `entitlements.plist`, `config.json`.
- IPC contract: the two channels exposed via `window.ada` (`onToggleRecording`, `transcribe`) — direction, payload type, return shape.
- A mermaid sequence diagram of the user flow: shortcut → toggle IPC → MediaRecorder → ArrayBuffer → main → Whisper → pbcopy → CGEvent Cmd+V.
- Note on the Swift `paste-helper` binary: present in the repo, not currently invoked at runtime (main.js uses an inline JXA `osascript` for CGEvent). Document it as a fallback option, not active code.

### `docs/build-and-release.md`

The authoritative reference for shipping a packaged build. Covers each ritual step *with the why*:

- `tccutil reset` — explains TCC caching: macOS pins permission decisions to a (bundle-id, code-signing-identity) pair, so a re-signed build looks like a different app; resetting forces a fresh prompt.
- `rm -rf /Applications/Ada.app` — avoids signature-mismatch errors when copying over a previously-signed bundle.
- `npm run build` — what electron-builder produces and where (`dist/mac-arm64/Ada.app`, `dist/*.dmg`).
- The re-sign step — explains why electron-builder's ad-hoc signing doesn't apply entitlements to nested binaries, and why `--deep` matters.
- Verifying the install: how to confirm entitlements stuck (`codesign -d --entitlements - /Applications/Ada.app`).
- A pointer at the top: "Most of the time, run `/build-clean` instead of doing this by hand."

### `docs/permissions.md`

Covers the two macOS permissions Ada needs and how each is granted.

Contents:
- **Microphone (NSMicrophone / TCC)** — gated by the `com.apple.security.device.audio-input` entitlement (`entitlements.plist`) plus `NSMicrophoneUsageDescription` in Info.plist (set via `extendInfo` in `package.json`). Triggered at runtime by `systemPreferences.askForMediaAccess('microphone')` in `main.js`.
- **Accessibility (input-monitoring)** — required because `CGEventPost` simulates Cmd+V keystrokes into the focused app. Triggered by `systemPreferences.isTrustedAccessibilityClient(true)`.
- How to check current status (System Settings → Privacy & Security paths).
- Why dev-mode (`npm start`) inherits the parent terminal's permissions, but a packaged build needs its own grants.

### `docs/whisper-integration.md`

Documents how `main.js` talks to OpenAI Whisper.

Contents:
- The endpoint (`POST https://api.openai.com/v1/audio/transcriptions`).
- The multipart body construction in `main.js` — why it's hand-rolled (no npm dependency) and what each part contains (`file`, `model`).
- Audio format chain: `MediaRecorder` produces WebM in the renderer → serialized as a `Uint8Array` over IPC → reassembled as a `Buffer` in main → uploaded as `audio/webm`.
- `config.json` schema: `openai_api_key`, `model`. Note that the file is in `.gitignore` and must never be committed.
- Failure modes: bad key, rate limit, empty audio. What the renderer sees in each.

### `docs/troubleshooting.md`

A punch-list keyed off the symptom, not the cause:

- **Shortcut does nothing.** Possible: another app holds the same `Control+Shift+Space` chord; Ada wasn't granted Accessibility. How to diagnose each.
- **Recording starts but transcription returns empty.** Possible: mic muted at the OS level; wrong default input device; entitlements not signed into the bundle.
- **"Pasted!" appears but nothing pastes.** Accessibility permission absent or revoked. The clipboard *is* set — paste works manually.
- **App crashes on launch with `config.json` error.** Missing or malformed config file.
- **Re-installed build still asks no permission prompts.** TCC has cached a denial; run `/reset-perms`.

Each entry says: how to confirm the cause (one command or check), then how to fix.

### `docs/development-workflow.md`

Explains how the four slash commands fit into a normal day:

- **Editing code → `/dev`.** No build needed; runs `npm start` and inherits terminal permissions.
- **Testing the packaged build → `/build-clean`.** When IPC, entitlements, or signing behavior is what you're testing.
- **Permission prompts misbehaving → `/reset-perms`.** Standalone TCC reset; relaunch Ada to retrigger.
- **"Mic isn't working" → `/diagnose-mic`.** Read-only checklist; doesn't fix anything, just tells you what's wrong.

Includes a short "when to bypass the slash command" note for cases where you genuinely need to run one ritual step in isolation.

## Slash commands

Each lives at `.claude/commands/<name>.md` as a markdown file with YAML frontmatter describing the command, followed by the prompt body that Claude executes when the user types `/<name>`. Format follows the standard Claude Code slash-command convention: `description` and optional `argument-hint` in frontmatter, body is the executable prompt.

### `/build-clean`

**Purpose:** Run the full clean build & install ritual end-to-end.

**Behavior:**
1. Print the five steps that are about to run.
2. Confirm with the user before any destructive step (`rm -rf /Applications/Ada.app` and `rm -rf dist/`). Single confirmation covering both is fine.
3. Run sequentially, halting on the first non-zero exit:
   a. `tccutil reset Microphone com.programow.ada` and `tccutil reset Accessibility com.programow.ada`
   b. `rm -rf /Applications/Ada.app dist/`
   c. `npm run build`
   d. `cp -R dist/mac-arm64/Ada.app /Applications/Ada.app`
   e. `codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app`
4. After step (e), verify entitlements stuck via `codesign -d --entitlements - /Applications/Ada.app` and report the result.
5. Tell the user to launch Ada and grant Microphone + Accessibility prompts.

**Constraints:** Refuses to skip step (e) — that step is the entire reason this command exists.

### `/reset-perms`

**Purpose:** Reset Microphone + Accessibility TCC entries for `com.programow.ada`.

**Behavior:**
1. Run `tccutil reset Microphone com.programow.ada` and `tccutil reset Accessibility com.programow.ada`.
2. Tell the user to relaunch Ada to retrigger the system prompts.

No confirmation needed — this command is idempotent and non-destructive.

### `/dev`

**Purpose:** Start Ada in dev mode with a sanity check.

**Behavior:**
1. Verify `config.json` exists and parses as JSON.
2. Verify `openai_api_key` is non-empty and not the placeholder string `sk-...`.
3. If either check fails, report what's wrong and stop. Otherwise:
4. Run `npm start` in the foreground.

### `/diagnose-mic`

**Purpose:** Read-only investigation when audio capture or transcription isn't working.

**Behavior:** Run each check, report findings as a punch list. Does not modify state.

1. Is `/Applications/Ada.app` present?
2. Are entitlements signed into the bundle? (`codesign -d --entitlements - /Applications/Ada.app` — looks for `com.apple.security.device.audio-input`)
3. Is the bundle's signature valid? (`codesign --verify --verbose /Applications/Ada.app`)
4. Is Ada currently running? (`pgrep -f Ada.app`)
5. Does `config.json` exist with a non-placeholder API key?

Report: each check as ✓ / ✗ with a one-line note on what to do if it failed.

## Edits to existing files

- **`README.md`** — add a one-line pointer near the top: "For architecture, build details, and troubleshooting, see [`docs/`](docs/README.md)." Trim the build/install section to a quick summary and link out.
- **`CLAUDE.md`** — replace the "Clean Build & Install Ritual" section body with: "Use `/build-clean` (defined in `.claude/commands/build-clean.md`). The ritual is documented in `docs/build-and-release.md`." Keep the rest of `CLAUDE.md` intact.
- **`.gitignore`** — no change. `.claude/commands/` is intentionally tracked.

## Risks & open questions

- **`/build-clean` is destructive.** Mitigation: explicit confirmation prompt before `rm -rf`, refuse to proceed if cwd isn't the repo root.
- **Mermaid in markdown** — GitHub renders it natively; if Guilherme later previews these in another tool, the diagram may degrade to plain code. Acceptable for now.
- **`/diagnose-mic` doesn't check TCC grant status.** Querying TCC programmatically requires Full Disk Access on macOS, which is overkill for a diagnostic. The check list will tell the user *to verify in System Settings*, which is the right tradeoff.

## Success criteria

- A new contributor (or future Claude session) can clone the repo, read `docs/README.md`, and understand within ten minutes what Ada does, how it's built, and how to debug it.
- Typing `/build-clean` produces an installed, working `/Applications/Ada.app` with entitlements signed in — without the user remembering any step manually.
- Typing `/diagnose-mic` on a broken install correctly identifies which of (missing app, missing entitlements, invalid signature, missing config) is the cause.
