# Vox Era — Tauri Monorepo & Multi-Provider STT Design

**Date:** 2026-05-03
**Status:** Draft (awaiting user review)
**Planning branch:** `tech-stack` (where this spec was authored)
**Implementation branch:** `execution` (created from `tech-stack` at the start of Plan A; all Plan A–D work commits here, then merges to `main` at the end of Plan D)
**Project name:** **Vox Era**
**Domain:** **vox-era.com**
**GitHub repo:** **programow/vox-era**
**Bundle id (macOS):** **com.vhtechnology.voxera**
**Package ids (npm scope):** **@vox-era/desktop**, **@vox-era/landing**
**Cargo crate name:** **voxera**
**Convention:** "Vox Era" for display, "vox-era" for URL slugs, "voxera" for identifiers that don't allow hyphens (bundle id, crate name).

---

## 1. Goal

Migrate the existing macOS-only Electron speech-to-text app (originally named "Ada", to be relaunched as **Vox Era**) into a cross-platform Bun monorepo containing:

1. **`packages/desktop`** (`@vox-era/desktop`) — a Tauri 2.x desktop app (macOS + Windows + Linux) with React + TypeScript frontend, Rust backend, multi-provider STT via Vercel AI SDK, OS-keychain-backed BYOK, SQLite-backed transcription history & stats, signed auto-update, and a Wispr-Flow-style overlay UI.
2. **`packages/landing`** (`@vox-era/landing`) — a Next.js static landing site (3 routes) deployed to S3 + CloudFront under `vox-era.com`.
3. **`packages/infra`** (`@vox-era/infra`) — Pulumi (TypeScript) infrastructure-as-code managing AWS (S3 site bucket, CloudFront distribution, ACM cert, IAM/OIDC role) and Cloudflare DNS (zone records + ACM validation + apex/www CNAMEs). State and secrets managed by **Pulumi Cloud** under the maintainer's personal account (`guilherme-vozniak-a-gmail-com`). Stack identifier: `guilherme-vozniak-a-gmail-com/vox-era/prod`.

The project ships with a comprehensive AI-assisted development workflow (slash commands, skills, docs, conventional commits, lefthook hooks, GitHub Actions CI with PR previews, signed release pipeline).

Non-goals at v1 (deferred to later, captured in §16):
- System audio loopback capture
- Dictionary / term biasing / inline correction features
- Flatpak / Snap / AUR / Homebrew distribution
- Master passphrase to unlock keys
- Telemetry of any kind
- Mobile (iOS / Android)
- E2E tests of the desktop app (Tauri E2E tooling is too immature)

---

## 2. Background

The current `main` branch (commit `4ce0e85`) is a working macOS-only Electron app:

- ~250 lines across `main.js` (lifecycle + Whisper API + paste), `renderer.js` (mic capture via MediaRecorder), `preload.js` (IPC bridge), `index.html` (minimal UI), plus `paste-helper.swift` (compiled binary for paste simulation).
- `config.json` holds OpenAI API key in plaintext (gitignored).
- Distribution via electron-builder DMG with hand-rolled signing ritual documented at `docs/build-and-release.md`.
- Permissions UX is brittle: ad-hoc signing changes invalidate TCC grants, requiring `tccutil reset` rituals.

**Why migrate:** The Electron app is single-platform, single-provider (OpenAI Whisper), key-in-plaintext, and has no test suite. The new product (Vox Era) is cross-platform, multi-provider, securely-stored, well-tested, distributable, with a marketing site — fundamentally a different shape of app, justifying a clean rewrite into Tauri rather than evolving the Electron code. The rename from Ada → Vox Era happens at the migration boundary; the legacy Electron app is removed once Vox Era reaches feature parity.

---

## 3. Architecture overview

```
                        ┌─────────────────────────────────┐
                        │   vox-era (Bun monorepo, root)  │
                        │   bun workspaces, no Turbo      │
                        └────────────┬────────────────────┘
                                     │
           ┌─────────────────────────┼──────────────────────────┐
           │                         │                          │
  ┌────────▼────────┐      ┌─────────▼─────────┐     ┌──────────▼─────────┐
  │ packages/       │      │ packages/         │     │ docs/, .claude/,   │
  │   desktop       │      │   landing         │     │ .github/, root     │
  │                 │      │                   │     │ tooling configs    │
  │ Tauri 2.x       │      │ Next.js (static)  │     │                    │
  │ • Rust backend  │      │ • 3 routes:       │     │ Slash commands,    │
  │ • React webview │      │   /, /privacy,    │     │ skills, lefthook,  │
  │ • cpal audio    │      │   /changelog      │     │ Biome, commitlint, │
  │ • keyring       │      │ • Tailwind +      │     │ GitHub Actions     │
  │ • SQLite (sqlx) │      │   shadcn-themed   │     │                    │
  │ • AI SDK STT    │      │   neobrutalism    │     │                    │
  │   (TS, webview) │      │ • Static export   │     │                    │
  │ • Tray + main   │      │   to S3+CloudFront│     │                    │
  │   window +      │      │                   │     │                    │
  │   overlay pill  │      │                   │     │                    │
  └─────────────────┘      └───────────────────┘     └────────────────────┘
```

**Key architectural decisions, justified:**

| Decision | Choice | Rationale |
|---|---|---|
| Workspace tool | Bun workspaces only (no Turbo/Nx) | 2 packages, no shared graph — orchestrators add cost without benefit |
| Migration shape | Side-by-side during port, clean cut at end | Keeps the legacy Electron app working as a reference until Tauri reaches feature parity |
| Tauri webview framework | React + Vite + TypeScript | Mature ecosystem, easy to test, neobrutalism component library available |
| Rust ↔ TS boundary | Hybrid: Rust owns OS + secrets + audio capture, TS owns UI + STT calls (AI SDK) | AI SDK is TS-only; secrets must stay out of webview state |
| Audio capture | Rust via `cpal` (cross-platform) | MediaRecorder support varies across native webviews; cpal gives uniform behavior + testability |
| Provider system | Data-driven adapter array, AI SDK powered | Adding a provider = one config entry, not new code paths |
| Secret storage | OS keychain via `keyring` crate | Industry-standard per-platform: Keychain (mac), Credential Manager/DPAPI (win), Secret Service (linux) |
| Pref storage | JSON via `tauri-plugin-store` | Small, atomic, debuggable |
| History storage | SQLite via `tauri-plugin-sql` | Indexed queries, scales to 10k+ rows, fast aggregations |
| Auto-update | S3-hosted manifest, minisign-signed | Stable URL, no rate limits, no shape translation |
| License | Apache 2.0 | Patent grant + trademark protection |
| Telemetry | Zero | BYOK + privacy is the differentiator |
| IaC tool | Pulumi (TypeScript) on Pulumi Cloud (personal account) | Matches the TS-heavy stack; Pulumi Cloud handles state + secrets management with zero infra bootstrap; free for personal use |
| DNS | Cloudflare (zone hosted there; proxy OFF / DNS-only) | User registered the domain at Cloudflare; AWS still terminates SSL via CloudFront + ACM |
| AWS access | OIDC role assumption from CI; profile `voxera` locally | No long-lived static keys in CI; profile `voxera` keeps local commands aligned with the right AWS account |

---

## 4. Repo layout

```
vox-era/                            # root directory; matches GitHub repo programow/vox-era
├── packages/
│   ├── desktop/                    # Tauri app (Plan B)
│   ├── landing/                    # Next.js static landing (Plan C)
│   └── infra/                      # Pulumi IaC: AWS + Cloudflare DNS (Plan D)
├── package.json                    # root: workspaces, shared scripts ("name": "vox-era")
├── bun.lockb                       # Bun lockfile
├── biome.json                      # Biome config (TS/JS lint + format)
├── lefthook.yml                    # Hook orchestration
├── commitlint.config.js            # Conventional commits config
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # PR checks: lint, typecheck, test, build (no signing)
│   │   ├── release.yml             # Tag-triggered: signed builds, GH releases, S3 publish
│   │   └── pr-preview.yml          # PR previews of landing page to S3
│   └── PULL_REQUEST_TEMPLATE.md
├── .claude/
│   ├── commands/                   # Slash commands (see §13)
│   └── settings.json
├── CLAUDE.md                       # Top-level AI dev guide (monorepo overview)
├── README.md                       # Top-level: what Vox Era is, link to docs/
├── CONTRIBUTING.md                 # Dev workflow, testing rules, branching
├── LICENSE                         # Apache 2.0
├── docs/                           # Long-form docs (see §13)
│   ├── README.md                   # Index
│   ├── architecture.md
│   ├── testing.md
│   ├── providers.md                # How to add a new STT provider
│   ├── build-and-release.md
│   ├── permissions.md              # Per-platform mic permission flow
│   ├── secrets.md                  # Threat model, what's stored where
│   ├── ci-cd.md
│   └── troubleshooting.md
└── packages/
    ├── desktop/                    # Tauri app
    │   ├── package.json            # "name": "@vox-era/desktop"
    │   ├── tsconfig.json
    │   ├── tauri.conf.json
    │   ├── vite.config.ts
    │   ├── vitest.config.ts
    │   ├── index.html              # webview entry
    │   ├── public/                 # static assets
    │   ├── src/                    # React + TS frontend
    │   │   ├── main.tsx
    │   │   ├── App.tsx
    │   │   ├── windows/
    │   │   │   ├── main/           # Main dashboard window
    │   │   │   ├── overlay/        # Bottom-center recording pill
    │   │   │   └── settings/       # Settings (rendered inside main window)
    │   │   ├── providers/          # Data-driven provider registry
    │   │   │   ├── index.ts        # PROVIDERS array
    │   │   │   ├── types.ts
    │   │   │   ├── openai.ts
    │   │   │   ├── azure-openai.ts
    │   │   │   ├── groq.ts
    │   │   │   ├── deepgram.ts
    │   │   │   ├── assemblyai.ts
    │   │   │   ├── elevenlabs.ts
    │   │   │   ├── fal.ts
    │   │   │   ├── gladia.ts
    │   │   │   └── revai.ts
    │   │   ├── lib/
    │   │   │   ├── invoke.ts       # Typed wrappers around Tauri invoke
    │   │   │   ├── transcribe.ts   # AI SDK orchestration
    │   │   │   ├── stats.ts        # Derived stats from SQLite
    │   │   │   └── format.ts       # Time, WPM, etc.
    │   │   └── components/         # shadcn-neobrutalism components
    │   ├── tests/
    │   │   ├── unit/               # *.test.ts colocated in src/ also
    │   │   ├── integration/        # MSW + happy-dom
    │   │   ├── functional/         # Full flow with audio fixtures
    │   │   └── fixtures/
    │   │       ├── audio/
    │   │       │   ├── hello-world.wav
    │   │       │   ├── silence.wav
    │   │       │   ├── noise.wav
    │   │       │   ├── long-speech.wav
    │   │       │   ├── multilingual.wav
    │   │       │   └── README.md   # Provenance + regen script
    │   │       └── responses/      # Canned provider HTTP responses
    │   └── src-tauri/              # Rust backend
    │       ├── Cargo.toml
    │       ├── tauri.conf.json -> ../tauri.conf.json   # symlinked
    │       ├── build.rs
    │       ├── src/
    │       │   ├── main.rs
    │       │   ├── lib.rs
    │       │   ├── audio/          # cpal capture, AudioSource trait
    │       │   │   ├── mod.rs
    │       │   │   ├── microphone.rs
    │       │   │   ├── permissions/
    │       │   │   │   ├── mod.rs
    │       │   │   │   ├── macos.rs    # objc2 + AVCaptureDevice (mic) + Accessibility check (Fn)
    │       │   │   │   ├── windows.rs  # registry check
    │       │   │   │   └── linux.rs    # cpal device open + clean error
    │       │   │   └── mock.rs
    │       │   ├── secrets/        # keyring wrapper
    │       │   │   ├── mod.rs
    │       │   │   └── mock.rs
    │       │   ├── settings/       # tauri-plugin-store wrapper
    │       │   ├── history/        # tauri-plugin-sql + queries
    │       │   │   ├── mod.rs
    │       │   │   ├── schema.rs
    │       │   │   ├── repo.rs
    │       │   │   ├── stats.rs
    │       │   │   └── retention.rs    # rolling 1-year purge
    │       │   ├── shortcut/       # global hotkey: standard.rs (plugin) + macos_fn.rs (CGEventTap)
    │       │   ├── tray/           # system tray + menu
    │       │   ├── clipboard/      # tauri-plugin-clipboard-manager
    │       │   ├── paste/          # synthetic paste via enigo crate
    │       │   └── commands.rs     # Tauri command exports
    │       └── tests/
    │           ├── integration/    # wiremock + audio fixtures
    │           └── fixtures/       # symlink to packages/desktop/tests/fixtures
    └── landing/                    # Next.js static landing
        ├── package.json            # "name": "@vox-era/landing"
        ├── tsconfig.json
        ├── next.config.mjs         # output: "export"
        ├── tailwind.config.ts
        ├── vitest.config.ts
        ├── playwright.config.ts
        ├── public/
        │   ├── demo.gif            # Recording demo animation
        │   └── og-image.png
        ├── src/
        │   ├── app/
        │   │   ├── layout.tsx
        │   │   ├── page.tsx        # / (home)
        │   │   ├── privacy/
        │   │   │   └── page.tsx    # /privacy
        │   │   └── changelog/
        │   │       └── page.tsx    # /changelog (build-time fetch from GH)
        │   ├── components/         # shadcn-neobrutalism components
        │   │   ├── hero.tsx
        │   │   ├── features.tsx
        │   │   ├── providers-grid.tsx
        │   │   ├── download.tsx
        │   │   ├── footer.tsx
        │   │   └── ui/             # base shadcn components
        │   └── lib/
        │       ├── github.ts       # Build-time release fetch
        │       └── providers-meta.ts  # Provider names + logos for grid
        └── tests/
            ├── unit/
            └── e2e/                # Playwright
```

---

## 5. Migration plan (Electron → Tauri, Ada → Vox Era)

Each phase ends with explicit documentation update steps so the repo is never in a state where the docs disagree with the code. Doc updates are part of the work, not a follow-up.

**Phase 1 (Bootstrap):**
1. Create `packages/desktop` and `packages/landing` skeletons.
2. Move root tooling (Biome, lefthook, commitlint, CI, root `package.json`) into place.
3. Existing Electron files (`main.js`, `preload.js`, `renderer.js`, `index.html`, `paste-helper*`, `entitlements.plist`, `dashboard.html`, `trayIconTemplate*.png`, root `package.json`'s electron config) **stay at the repo root** as `legacy/electron/` for the duration of the migration. They keep working via `bun run dev:legacy` in case the user wants to compare behavior.
4. **DOCS — Phase 1 update:**
   - Create root `CLAUDE.md` describing the monorepo (workspaces, packages, where things live, how to run dev, how to navigate). Replaces the existing Electron-focused `CLAUDE.md`.
   - Create root `README.md` (top-level project overview, install instructions per OS placeholder, link to `docs/`).
   - Create `CONTRIBUTING.md` (branching, conventional commits, hook/test rules).
   - Create `LICENSE` (Apache 2.0).
   - Create `docs/README.md` (index pointing to placeholder docs that will fill in over Phase 2/3).
   - Update `.gitignore` for new build outputs (`packages/*/dist/`, `packages/*/out/`, `packages/desktop/src-tauri/target/`, `bun.lockb`-no-actually-keep-it).

**Phase 2 (Tauri parity build, in `packages/desktop`):**
5. Tauri scaffold + Rust backend modules built per §6.
6. **DOCS — after Tauri scaffold lands:**
   - Write `docs/architecture.md` describing process model + Tauri command surface + sequence diagram from §6.9.
   - Write `packages/desktop/README.md` (package-local: Tauri specifics, frontend/backend boundary, how to add a Rust command, how to add a React window).
   - Update root `CLAUDE.md` to point at `docs/architecture.md`.
7. Audio capture & permissions module + secret storage built (`audio/`, `secrets/`).
8. **DOCS — after audio + secrets modules land:**
   - Write `docs/permissions.md` (per-platform mic permission flow, recovery, deep links).
   - Write `docs/secrets.md` (storage backend per platform, threat model, what's stored where).
9. Settings + history modules built (`settings/`, `history/`, SQLite schema + migrations).
10. React frontend + windows + provider settings UI built per §6.
11. Feature parity reached: shortcut → record → transcribe → paste, with at least OpenAI provider working end-to-end.
12. All other 9 providers added (data-driven, ~50 lines each) per §7.
13. **DOCS — after provider system is in place:**
   - Write `docs/providers.md` (the per-provider adapter contract, how to add one, references `/add-provider` slash command).
   - Update `packages/desktop/README.md` with the provider list.
14. Auto-update wired up per §10.4.

**Phase 3 (Polish & ship):**
15. Code signing + GPG/apt/dnf pipeline per §10.
16. **DOCS — after release pipeline lands:**
   - Write `docs/build-and-release.md` (Tauri local build, signing setup, release workflow walkthrough — replaces the legacy Electron build doc).
   - Write `docs/install-linux.md` (apt + dnf repo setup commands for end-users, GPG key import).
   - Write `docs/ci-cd.md` (GitHub Actions overview, branch protection rules, PR previews).
17. Landing page built per §8.
18. **DOCS — after landing lands:**
   - Write `packages/landing/README.md` (Next.js specifics, deploy preview workflow, how to update copy/components).
   - Update `docs/README.md` index to include landing-related docs.
19. CI matrix green on all 3 platforms.
20. First signed release tag pushed; install on a test machine on each platform.
21. **DOCS — first release smoke-test feedback loop:**
   - Write `docs/troubleshooting.md` (symptom-keyed punch list — what to do if mic fails, paste fails, update fails, etc., based on issues encountered during smoke testing).
   - Update `docs/development-workflow.md` (when to use which slash command, common workflows).

**Phase 4 (Clean cut, rename, archive Electron):**
22. Delete `legacy/electron/` once Vox Era reaches feature parity. Commit `chore: remove legacy Electron Ada — replaced by Vox Era Tauri build`.
23. **DOCS — Phase 4 finalization sweep:**
   - Audit every doc file (`docs/*.md`, root `CLAUDE.md`, root `README.md`, `CONTRIBUTING.md`, both `packages/*/README.md`) for any remaining "Ada" references in forward-looking context (history/changelog references to Ada are fine — they're historical fact). Replace `Ada` → `Vox Era` where appropriate.
   - Audit for any remaining Electron-era references (`main.js`, `tccutil reset` rituals tied to ad-hoc signing, OpenAI-only assumptions, etc.). Remove or replace.
   - Verify all slash commands in `.claude/commands/` reference Vox Era's stack, not Electron's.
   - Verify `docs/troubleshooting.md` and `docs/build-and-release.md` are Tauri-focused.
   - Update root `CLAUDE.md` final state: monorepo overview, packages summary, slash commands inventory, links to all docs/ entries.
   - Update top-level `README.md` final state: short pitch + install per OS + links to landing site at `vox-era.com`.

**Branching:** Plan A creates a new `execution` branch from `tech-stack` and switches to it (Task 1, Step 4). All Plan A–D commits land on `execution`. The final PR (Plan D Task 19) merges `execution` → `main`. The `tech-stack` branch is preserved as the planning/spec record — it does not receive implementation commits. Multiple PRs may be opened from `execution` if the implementor prefers smaller chunks; default is one bundled PR at the end of Plan D.

### 5.1 Documentation update discipline (cross-cutting rule)

**Rule:** Documentation is part of "done." A PR that introduces a new architectural surface, slash command, dependency, or workflow change without a corresponding doc update is incomplete.

**Trigger → mandatory doc update table** (referenced from `CONTRIBUTING.md`):

| Trigger | Update these docs |
|---|---|
| New STT provider added | `docs/providers.md` (registry section), `packages/desktop/README.md` (provider list), `packages/landing/src/components/providers-grid.tsx` (logo grid), pricing entry in `ProviderConfig.pricing` with `lastUpdated` ISO date |
| New model added to existing provider | Update `defaultModels` array AND `pricing` table in the provider's adapter file with current per-minute USD rate from provider docs; bump `lastUpdated` |
| Provider rate change detected (price-page diff, billing surprise) | Update the provider's `pricing.lastUpdated` + per-model rate; spec says "audit at least quarterly" |
| New Tauri command exposed | `docs/architecture.md` (command surface table) |
| New slash command added | `docs/development-workflow.md` (when-to-use list), root `CLAUDE.md` (commands inventory) |
| New target platform | `docs/permissions.md`, `docs/install-<platform>.md`, `docs/build-and-release.md`, `docs/ci-cd.md`, root `README.md` (downloads section) |
| SQLite schema migration | `docs/architecture.md` (history schema section), update migration history list |
| Signing or release pipeline change | `docs/build-and-release.md`, `docs/ci-cd.md` |
| New external dependency (Cargo or npm) | If the dep is architecturally significant: `docs/architecture.md` references section. Otherwise: lockfile change is enough. |
| New audio source / capture mode | `docs/architecture.md` (audio module section), `docs/permissions.md` |
| Threat model change (new secret storage path, telemetry added, etc.) | `docs/secrets.md`, `packages/landing/src/app/privacy/page.tsx` (the public privacy page) |
| New required GitHub Secret | `docs/build-and-release.md` (secrets list), `docs/ci-cd.md` |

**Enforcement:** the PR template includes a "docs updated" checkbox; the spec-reviewer subagent (when subagent-driven development is in use) checks for the docs-updated obligation against this trigger table during review.

---

## 6. Desktop app architecture

### 6.1 Process model

- **Main Rust process** (Tauri runtime) — owns OS resources, lifecycle, secrets, audio capture, history DB, IPC commands.
- **Webview** (WKWebView/WebView2/WebKitGTK) — runs the React UI, handles all UI state, calls AI SDK for STT, communicates with main via Tauri's `invoke()` IPC.

Security boundary: **the webview never touches OS keys, the file system directly, or the audio device.** Every privileged operation is a typed Tauri command exposed by Rust.

**Tauri 2 capabilities** (NOT "allowlist" — the term changed in Tauri 2): each plugin requires explicit permission grants in `src-tauri/capabilities/*.json` files. None are enabled by default. The capability files for Vox Era live at `src-tauri/capabilities/default.json` and grant only what's needed:

```json
// src-tauri/capabilities/default.json (sketch)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capabilities for the main webview",
  "windows": ["main", "overlay"],
  "permissions": [
    "core:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-text",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "store:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install"
  ]
}
```

Documented in `docs/architecture.md`. Capabilities files are version-controlled.

### 6.2 Tauri commands surface (Rust → TS contract)

Defined in `src-tauri/src/commands.rs`. Naming: snake_case in Rust, camelCase in TS. All commands are typed (return `Result<T, AdaError>`).

| Command | Purpose |
|---|---|
| `check_microphone_permission` | Returns `Granted` / `Denied` / `NotDetermined` |
| `request_microphone_permission` | Triggers OS prompt (macOS only meaningful — others are no-op or registry check) |
| `open_system_settings(panel)` | Deep links to OS settings panel for permission grant |
| `start_recording` | Begins cpal capture, returns recording session id |
| `stop_recording(session_id)` | Stops capture, returns audio bytes (wav, mono, 16kHz) |
| `get_secret(provider_id)` | Returns API key from OS keychain (or null) |
| `set_secret(provider_id, key)` | Stores API key in OS keychain |
| `delete_secret(provider_id)` | Removes API key |
| `get_setting(key)` / `set_setting(key, value)` | JSON store wrapper |
| `list_transcriptions(limit, offset)` | Paginated history |
| `save_transcription(record)` | Insert into SQLite |
| `delete_transcription(id)` | Soft delete |
| `purge_history(scope)` | Manual purge (`all` / `before_date`) |
| `compute_stats(range)` | Derived stats (total words, streak, WPM, time saved, top provider) |
| `paste_text(text)` | Clipboard write + synthetic paste |
| `register_shortcut(combo)` | Updates global hotkey (Fn or standard — see §6.10) |
| `check_accessibility_permission` | macOS-only: returns whether Accessibility (kTCCServiceAccessibility) is granted (required for Fn-key shortcut) |
| `request_accessibility_permission` | macOS-only: opens System Settings to the Accessibility pane |
| `check_for_update` | Manual update poll trigger (auto-runs on schedule too) |

All commands are introspectable via `invoke()` from TS using a typed wrapper at `src/lib/invoke.ts` that mirrors the Rust signatures.

### 6.3 Audio capture & permissions module

Location: `src-tauri/src/audio/`.

**Trait:**
```rust
pub trait AudioSource: Send + Sync {
    fn check_permission(&self) -> PermissionState;
    fn request_permission(&self) -> Result<PermissionState>;
    fn start_capture(&self) -> Result<CaptureHandle>;
}

pub enum PermissionState { Granted, Denied, NotDetermined }

pub struct CaptureHandle {
    session_id: Uuid,
    stop: Box<dyn FnOnce() -> Result<Vec<u8>> + Send>,  // returns wav bytes
}
```

**Implementations:**
- `MicrophoneSource` — uses `cpal` for cross-platform audio I/O, returns mono 16kHz wav bytes (the lowest-common-denominator format every STT provider accepts).
- `MockMicrophoneSource` — loads `tests/fixtures/audio/<name>.wav` based on test config.
- `LoopbackSource` — **deferred to v2.**

**Permission flow per platform** (per Q17 design):

*macOS:*
- `Info.plist` declares `NSMicrophoneUsageDescription`. In Tauri 2, this is set via `tauri.conf.json` → `bundle.macOS.infoPlist` (key name verified at https://tauri.app/reference/config/#macconfig during implementation — if `infoPlist` is wrong, the alternative is `extendInfo`; both have appeared in Tauri history).
- Entitlement `com.apple.security.device.audio-input` baked into signed bundle (entitlements file path: `tauri.conf.json` → `bundle.macOS.entitlements`).
- `request_permission` calls `AVCaptureDevice.requestAccess(for: .audio)` via `objc2` crate; returns the user's choice synchronously after they respond.
- TCC stays granted across releases because we sign with a stable Apple Developer ID.
- Denied state: deep link to `x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone`.

*Windows:*
- Read `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged\<exe-path>\Value` to detect the system toggle state.
- Denied state: deep link to `ms-settings:privacy-microphone`.
- No prompt — system either allows or silently blocks.

*Linux:*
- Attempt `cpal` device open. On failure, surface a clean error ("Could not open microphone — check your system audio settings or run `pavucontrol` to verify input device is enabled").
- No deep link (no consistent settings panel across desktops).

**UI integration:** the main window and the overlay both subscribe to a Rust-emitted permission state event (`tauri::Manager::emit_all`), update reactively, and surface OS-appropriate guidance when not granted.

### 6.4 Secret storage

Location: `src-tauri/src/secrets/`.

**Library:** `keyring` crate (v3.x, with `sync-secret-service` feature on Linux — the actual feature flag in `keyring` v3, not `secret-service`). Vox Era's Rust is sync around Tauri commands, so the sync variant fits; switch to `async-secret-service` only if the codebase migrates to async. (`keyring` v4 exists with a different API; v1 pins to v3 for stability.)

**Schema:** service name `vox-era`, account name = provider id (e.g., `openai`, `groq`).

**API exposed to TS:**
- `get_secret(provider_id)` — returns key or null. **Just-in-time:** the value is held in webview memory only for the duration of one transcription request, never persisted in TS state.
- `set_secret(provider_id, key)` — stores in keychain.
- `delete_secret(provider_id)` — removes.
- `list_configured_providers()` — returns the list of provider ids that currently have a key set (for UI to show "configured" badges).

**Defense in depth:**
- `zeroize` crate wipes `String` containing the key from memory after use on the Rust side.
- Custom `Debug` impl on key wrapper redacts the value in any log output (`SecretKey(redacted)`).
- Integration test scrapes log output for known key patterns (`sk-...`, etc.) and fails if any match.
- No key ever appears in error messages — provider HTTP errors are mapped to `AdaError` variants before being returned.

**Threat model (documented in `docs/secrets.md` and on the `/privacy` page):**
- macOS Keychain provides per-app ACL — strongest of the three.
- Windows Credential Manager and Linux Secret Service are per-user — any process running as the user can read secrets via the OS API. This is a platform limitation, the same one every credential-storing app faces (1Password, GitHub CLI, Docker Desktop, etc.).
- A user concerned about same-user-account malware should run Vox Era under a dedicated user account.

### 6.5 Settings (non-secret) storage

Location: `src-tauri/src/settings/`.

**Library:** `tauri-plugin-store` (writes JSON to `app_config_dir()`).

**Schema (TypeScript types, mirrored in Rust):**
```ts
interface Settings {
    activeProviderId: string;        // "openai"
    activeModelId: string;           // "whisper-1"
    hotkey: string;                  // platform-specific (see §6.10): "Fn" on macOS, "CommandOrControl+Shift+Space" on Windows/Linux
    micDeviceId: string | null;      // null = system default
    theme: "light" | "dark" | "system";
    history: {
        retentionDays: 30 | 90 | 365 | 1825 | -1;  // -1 = never purge
        autoDelete: boolean;
    };
    overlay: {
        position: "bottom-center" | "bottom-right" | "top-center";
        showOnIdle: boolean;
    };
    onboardingCompleted: boolean;
}
```

Defaults at first launch (per Q19c and §6.10):
- `retentionDays = 365`
- `hotkey = 'Fn'` on macOS, `'CommandOrControl+Shift+Space'` on Windows/Linux
- `theme = 'system'`

### 6.6 Transcription history & stats (SQLite)

Location: `src-tauri/src/history/`.

**Library:** `tauri-plugin-sql` (uses `sqlx` under the hood, SQLite mode). DB file at `app_data_dir()/vox-era.db`.

**Schema (initial):**
```sql
CREATE TABLE transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,        -- unix epoch ms
    text TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    deleted_at INTEGER NULL              -- soft delete for undo
);
CREATE INDEX idx_created_at ON transcriptions(created_at);
CREATE INDEX idx_provider ON transcriptions(provider_id);
```

**Migrations:** `tauri-plugin-sql` migrations are **registered in Rust code**, not auto-discovered from a glob. Each migration is a `Migration { version, description, sql, kind }` value passed to `Builder::new().add_migrations()`. The SQL itself can be inlined or loaded via `include_str!("../migrations/0001_init.sql")`. The `migrations/` directory is a **source-file convention only** — it does not participate in plugin auto-discovery.

```rust
// src-tauri/src/history/mod.rs (sketch)
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create transcriptions table",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        // future:
        // Migration { version: 2, description: "...", sql: include_str!(...), kind: MigrationKind::Up },
    ]
}
```

**Stats queries** (in `history/stats.rs`). Each row carries `provider_id` and `model_id`, which is **load-bearing** — the dashboard's per-provider metrics, top-model breakdown, and estimated cost calculation all depend on them.
- **Total words** (lifetime, this week, this month): `SELECT SUM(word_count) FROM transcriptions WHERE deleted_at IS NULL [AND created_at >= ?]`
- **Streak (consecutive days dictated)**: `SELECT DISTINCT date(created_at/1000, 'unixepoch') FROM ... ORDER BY 1 DESC` then walk for gaps in TS
- **Average WPM**: `SELECT AVG(word_count * 60000.0 / duration_ms) FROM ... WHERE duration_ms > 0`
- **Time saved** (vs 45 WPM typing baseline): `(SUM(word_count) / 45.0) - (SUM(duration_ms) / 60000.0)` minutes
- **Top provider**: `SELECT provider_id, COUNT(*) c FROM ... GROUP BY 1 ORDER BY c DESC LIMIT 1`
- **Top model**: `SELECT provider_id, model_id, COUNT(*) c FROM ... GROUP BY 1, 2 ORDER BY c DESC LIMIT 1`
- **Estimated cost** (lifetime, this week, this month): joins each row to its provider+model rate, computed in TS:
  ```ts
  // packages/desktop/src/lib/stats.ts
  function estimatedCost(rows: Transcription[], pricing: PricingTable): number {
      return rows.reduce((acc, row) => {
          const rate = pricing[row.provider_id]?.[row.model_id]?.perMinuteUSD ?? 0;
          return acc + (row.duration_ms / 60000) * rate;
      }, 0);
  }
  ```
- **Cost breakdown by provider** (for chart/list): `SELECT provider_id, SUM(duration_ms) FROM ... GROUP BY 1` then multiply by per-provider rates in TS.

The dashboard renders cost as `"$X.XX (estimated)"` with a `?` tooltip explaining: "Estimated using rates from provider docs, last updated YYYY-MM-DD. Actual billing may vary based on your plan, free tier, or quota."

**Retention** (in `history/retention.rs`):
- On app start (and once per 24h while running), execute: `UPDATE transcriptions SET deleted_at = ? WHERE created_at < ? AND deleted_at IS NULL` followed by `DELETE FROM transcriptions WHERE deleted_at < ?` (purges soft-deleted rows older than 30 days).
- The window comes from `settings.history.retentionDays`; default 365.
- Vacuum runs monthly to reclaim disk space.

### 6.7 Provider system

Location: `packages/desktop/src/providers/`.

**Library:** Vercel AI SDK (`ai` package) + per-provider `@ai-sdk/<provider>` packages. AI SDK runs in the webview (TS), receives the API key via a just-in-time `invoke('get_secret', ...)` call.

**Type contract** (`providers/types.ts`):
```ts
export interface ProviderConfig {
    id: string;                          // "openai"
    name: string;                        // "OpenAI"
    logoSrc: string;                     // /logos/openai.svg
    docsUrl: string;
    apiKeyHelpUrl: string;               // "Where do I get my key?"
    // Builds an AI SDK transcription model bound to the given key.
    // Each provider implementation calls its own AI SDK factory:
    //   createOpenAI({ apiKey }).transcription(modelId)
    //   createGroq({ apiKey }).transcription(modelId)
    //   etc.
    makeModel: (modelId: string, apiKey: string) => TranscriptionModel;
    listModels: ((apiKey: string) => Promise<Model[]>) | null;
    defaultModels: Model[];              // fallback if no listModels or fetch fails
    validateKey?: (apiKey: string) => Promise<boolean>;  // optional sanity check
    pricing: Record<string, { perMinuteUSD: number; lastUpdated: string }>;
    // Per-model price in USD per minute of audio. lastUpdated is ISO date.
    // Source URL goes in pricingDocsUrl below.
    pricingDocsUrl: string;
}
export interface Model {
    id: string;
    displayName: string;
    description?: string;
}
```

**Registry** (`providers/index.ts`): one array entry per provider. Adding a provider = ~30–50 lines + tests.

**Providers shipped at v1** (all AI SDK transcription providers per https://ai-sdk.dev/docs/ai-sdk-core/transcription as of 2026-05-03, ordered alphabetically):
AssemblyAI, Azure OpenAI, Deepgram, ElevenLabs, Fal, Gladia, Groq, OpenAI, Rev.ai. **9 providers at v1.**

*Note:* an earlier draft of this spec listed Hume and Lmnt; on validation against the AI SDK transcription docs they are not currently AI SDK transcription providers and have been removed. Azure OpenAI was added because it is documented and useful for users on Azure-tenant API keys. If Hume/Lmnt are added to AI SDK in future, they slot in as additional `PROVIDERS` array entries with no other changes.

**Model fetching strategy:**
| Provider | Fetch strategy |
|---|---|
| OpenAI | `GET /v1/models` filtered to known transcription model IDs |
| Azure OpenAI | `GET {endpoint}/openai/models?api-version=...` filtered (deployment-scoped via Azure config) |
| Groq | `GET /openai/v1/models` filtered to STT models |
| ElevenLabs | `GET /v1/models` filtered |
| Fal | Hardcoded list (catalog API exists at fal.ai/models but auth/listing semantics vary; upgrade to fetch when stable) |
| Deepgram | Hardcoded list (no models endpoint) |
| AssemblyAI | Hardcoded list (configured by feature flags, not models) |
| Gladia | Hardcoded list |
| Rev.ai | Hardcoded list |

When `listModels` is null OR the fetch fails, the UI falls back to `defaultModels`. There's also a free-text "custom model" override input per provider for when a brand-new model drops before we update the adapter.

**Transcription orchestration** (`src/lib/transcribe.ts`):
```ts
import { experimental_transcribe as transcribeAi } from 'ai';

export async function transcribe(audio: Blob): Promise<string> {
    const activeProviderId = await invoke('get_setting', { key: 'activeProviderId' });
    const activeModelId = await invoke('get_setting', { key: 'activeModelId' });
    const provider = PROVIDERS.find(p => p.id === activeProviderId)!;
    const apiKey = await invoke('get_secret', { providerId: provider.id });
    if (!apiKey) throw new Error('No API key configured for provider');
    // Each provider exports a factory like `createOpenAI({ apiKey })`;
    // ProviderConfig.makeModel encapsulates that per-provider call.
    const model = provider.makeModel(activeModelId, apiKey);
    const { text } = await transcribeAi({
        model,
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;
}
```

Key is held only in this function's scope — when the call completes, the local `apiKey` reference is dropped. The `apiKey` is passed to `provider.makeModel(...)` which constructs an AI SDK model bound to that key for a single call.

**`ProviderConfig.makeModel`** wraps the per-provider AI SDK factory pattern (`createOpenAI({ apiKey }).transcription(modelId)` for OpenAI, etc.), so the orchestration code stays uniform regardless of provider differences.

### 6.8 UI surface

Three windows, each a separate Tauri webview:

**Window 1 — Tray icon + menu** (NOT a webview — created programmatically in Rust setup hook via `TrayIconBuilder::new()` + `Menu::with_items()` + `on_menu_event` callback. No HTML, no React, just native tray UI):
- Always visible in macOS menu bar / Windows taskbar / Linux tray.
- Status indicator: idle / recording / transcribing (icon color/animation).
- Menu items:
  - Active provider/model display (e.g., "OpenAI · whisper-1")
  - "Switch provider →" submenu (lists configured providers)
  - "Open Vox Era" (opens main window)
  - "Stats: 1,234 words today" (read-only display)
  - "Quit Vox Era"

**Window 2 — Main window (dashboard + settings)** (defined in `tauri.conf.json` → `app.windows[0]`. Size: 900×680, resizable, hidden on close to tray):
- **Tabs:** Dashboard / History / Settings / About
- **Dashboard tab:** stats panel (today/week/month words, streak, avg WPM, time saved, top provider, top model, **estimated cost** today/week/month/lifetime per provider with a "how is this calculated?" tooltip), recent 10 transcriptions list, quick actions.
- **History tab:** paginated full history with search, filter by provider/date, export to .txt or .md, manual delete/purge.
- **Settings tab:**
  - **Providers** subsection: scrollable list of provider cards. Each card has: name + logo, API key input (password field, masked), "Validate" button (calls `validateKey` if defined), model picker (populated from `listModels` or defaults), "Custom model" free-text override, "Set as active" toggle.
  - **Recording** subsection: hotkey config (with click-to-record-combo input — see §6.10 for the macOS Fn-key special case + cross-platform fallback), microphone device picker (lists `cpal` devices), test recording button.
  - **Overlay** subsection: position (bottom-center / bottom-right / top-center), show-when-idle toggle.
  - **History** subsection: retention period dropdown, auto-delete toggle, manual "Purge all" button.
  - **Theme** subsection: light/dark/system, accent color (neobrutal palette: yellow / pink / cyan / lime).
  - **Updates** subsection: auto-update toggle, "Check now" button, current version display.
- **About tab:** version, license, links to source/docs/privacy, threat-model summary.

**Window 3 — Overlay pill** (defined in `tauri.conf.json` → `app.windows[1]`. Size: ~280×64, borderless, transparent, always-on-top):
- Tauri config: `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`.
- Position: bottom-center of active monitor by default; saved per-monitor if user drags.
- Cross-platform window-level: `floating` on macOS (stays above fullscreen), `WS_EX_TOPMOST + WS_EX_TOOLWINDOW` on Windows, X11 `_NET_WM_STATE_ABOVE` on Linux.
- States:
  - **Hidden** (idle, when `showOnIdle: false`)
  - **Idle pill** (small dot, when `showOnIdle: true`)
  - **Recording** (waveform animation + duration counter)
  - **Transcribing** (spinner)
  - **Result preview** (briefly shows last text, auto-hides after 3s)
- Click to expand → small card with: "Copy last", "Switch provider →", "Open Vox Era", "Stop recording" (when recording).
- v2 deferred actions: "Correct", "Add to dictionary".

### 6.10 Global hotkey — macOS Fn key special case (and cross-platform fallback)

**Default hotkey per platform:**
| Platform | Default | Mechanism |
|---|---|---|
| macOS | **Fn (function key)** | Custom: `CGEventTap` watching `kCGEventFlagsChanged` for `kCGEventFlagMaskSecondaryFn` toggle |
| Windows | `Ctrl+Shift+Space` | `tauri-plugin-global-shortcut` |
| Linux | `Ctrl+Shift+Space` | `tauri-plugin-global-shortcut` |

**Why a special case for Fn on macOS:**

The macOS Fn key is **not a normal modifier**. The standard `tauri-plugin-global-shortcut` (built on the `global-hotkey` Rust crate) does not support Fn as a hotkey because Fn isn't part of the cross-platform modifier abstraction — it's a hardware-level key whose state is exposed only via low-level Core Graphics events.

The well-known way (used by Wispr Flow, SuperWhisper, and most macOS dictation apps) is:

1. Set up a `CGEventTap` via the `core-graphics` Rust crate, listening for `kCGEventFlagsChanged` events.
2. On each flags-changed event, inspect the event's flags for `kCGEventFlagMaskSecondaryFn`.
3. Toggle from off → on = start recording. Toggle from on → off = stop recording (push-to-talk style) OR a tap-and-release pattern (configurable).
4. For non-Fn shortcuts on macOS, fall back to `tauri-plugin-global-shortcut` (same code path as Windows/Linux).

**Required permission — Accessibility (TCC `kTCCServiceAccessibility`):**

A `CGEventTap` that monitors keyboard events at the global level requires the **Accessibility** permission, separate from Microphone. Specifically:
- Bundle entitlement (in `entitlements.plist`): the entitlement itself is implicit — macOS prompts for Accessibility on first event-tap creation regardless.
- TCC bucket: `kTCCServiceAccessibility` (Privacy & Security → Accessibility → Vox Era toggle).
- Deep link: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`.
- Without it: the `CGEventTap` returns `null` from `CGEvent.tapCreate(...)`. The app detects this and falls back to a documented combo (e.g., `Cmd+Shift+Space`) with a banner: *"Vox Era's default Fn-key shortcut needs Accessibility permission. Grant it in System Settings to use Fn, or pick a different hotkey in Settings."*

**Privacy implication, documented honestly in `/privacy`:**

A global `CGEventTap` sees **all** keyboard events on the system, not just Fn. We only inspect the flags field; key codes and characters are never read, never logged, never stored. This is the same privacy trade-off Wispr Flow and SuperWhisper accept; the alternative is to forfeit the Fn key feature. The privacy page documents:
- What the event tap does (reads the modifier flags field of every key event, ignores everything else).
- What it doesn't do (does not capture characters, key codes, or content).
- A code link to the file (`src-tauri/src/shortcut/macos_fn.rs`) for verification.
- A user opt-out: switch to a non-Fn shortcut and the event tap is destroyed.

**Module structure:**
```
src-tauri/src/shortcut/
├── mod.rs           # ShortcutManager trait + state machine
├── standard.rs      # tauri-plugin-global-shortcut wrapper (Win/Linux/macOS non-Fn)
├── macos_fn.rs      # core-graphics CGEventTap for Fn key (macOS only)
└── mock.rs          # test impl: direct trigger() function
```

**Trait:**
```rust
pub trait ShortcutManager: Send + Sync {
    fn register(&self, combo: HotkeyCombo) -> Result<()>;
    fn unregister(&self) -> Result<()>;
    fn check_permission(&self) -> AccessibilityState;  // macOS Fn case only
    fn request_permission(&self) -> Result<()>;        // macOS Fn: opens Settings
}

pub enum HotkeyCombo {
    Fn,                                    // macOS only
    Standard(String),                      // "Ctrl+Shift+Space", etc.
}
```

Production wires `MacOsFnTap` for `Fn`, `StandardShortcut` (via plugin) for everything else. Tests wire `MockShortcutManager` whose `register` call returns immediately and exposes a `trigger()` method to simulate the user pressing the key.

**`docs/permissions.md` covers two TCC permissions** (was one before this addition): Microphone (always required) + Accessibility (only required if user picks Fn-key hotkey on macOS, which is the default).

### 6.11 Recording flow (end-to-end, sequence)

```
1. User presses hotkey (default: macOS = Fn, Windows/Linux = Ctrl+Shift+Space)
2. Rust: shortcut::ShortcutManager handler fires (CGEventTap on macOS-Fn, tauri-plugin-global-shortcut otherwise)
3. Rust: emit `recording_started` event → overlay + tray update
4. Rust: audio::MicrophoneSource::start_capture (cpal opens default input)
5. cpal streams f32 samples → Rust ring buffer + WAV encoder
6. (User speaks)
7. User presses hotkey again (toggle)
8. Rust: stop capture, finalize WAV bytes (16kHz mono PCM)
9. Rust: emit `transcribing_started` event
10. Rust: return WAV bytes to webview via the open command's response
11. TS: `transcribe(blob)` — fetches API key via invoke, calls AI SDK
12. AI SDK: HTTPS POST to provider with audio + auth
13. AI SDK: returns transcribed text
14. TS: invoke('save_transcription', { text, duration, words, provider, model })
15. Rust: SQLite insert
16. TS: invoke('paste_text', { text })
17. Rust: clipboard write + synthetic paste (CGEvent / SendInput / xdotool/AT-SPI)
18. Rust: emit `transcription_complete` event → overlay shows preview, tray returns to idle
```

Error paths (network failure, denied permission, missing key, quota exceeded) all bubble up to the UI as typed `AdaError` variants with user-facing messages and recovery suggestions.

---

## 7. Provider system details

Covered in §6.7. The salient design property: **adding a new provider is a pure-data change.** Schema:
```ts
// packages/desktop/src/providers/groq.ts
import { createGroq } from '@ai-sdk/groq';
import type { ProviderConfig } from './types';

export const groqConfig: ProviderConfig = {
    id: 'groq',
    name: 'Groq',
    logoSrc: '/logos/groq.svg',
    docsUrl: 'https://console.groq.com/docs/speech-text',
    apiKeyHelpUrl: 'https://console.groq.com/keys',
    pricingDocsUrl: 'https://groq.com/pricing/',
    makeModel: (modelId, apiKey) => createGroq({ apiKey }).transcription(modelId),
    listModels: async (apiKey) => {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        const json = await res.json();
        return json.data
            .filter((m: any) => m.id.includes('whisper') || m.id.includes('distil'))
            .map((m: any) => ({ id: m.id, displayName: m.id }));
    },
    defaultModels: [
        { id: 'whisper-large-v3', displayName: 'Whisper Large v3' },
        { id: 'whisper-large-v3-turbo', displayName: 'Whisper Large v3 Turbo' },
        { id: 'distil-whisper-large-v3-en', displayName: 'Distil Whisper (English)' },
    ],
    pricing: {
        // Source: https://groq.com/pricing/ (verify at impl time and on each rate update)
        'whisper-large-v3': { perMinuteUSD: 0.000185, lastUpdated: '2026-05-03' },
        'whisper-large-v3-turbo': { perMinuteUSD: 0.000067, lastUpdated: '2026-05-03' },
        'distil-whisper-large-v3-en': { perMinuteUSD: 0.000033, lastUpdated: '2026-05-03' },
    },
};
```

And `providers/index.ts` is just:
```ts
import { openaiConfig } from './openai';
import { groqConfig } from './groq';
// ...
export const PROVIDERS = [openaiConfig, groqConfig, /* ... */] as const;
```

Tests run a generic test suite per provider (validates the contract: SDK is callable, listModels returns valid Model[] when implemented, defaultModels non-empty, etc.).

---

## 8. Landing page (`@vox-era/landing`)

### 8.1 Tech stack

- **Next.js 15+** (App Router), `output: "export"` for static SSG.
- **Tailwind CSS** + **shadcn/ui** themed via [neobrutalism.dev](https://www.neobrutalism.dev) component variants (hard borders, offset shadows, bold colors).
- **TypeScript**, **Biome** for lint+format.
- **Vitest** for unit tests, **Playwright** for E2E against the built static export.
- **No backend** — fully static.

### 8.2 Routes

**`/` (home)** — composed of these sections, top to bottom:
1. **Hero** — headline, subheadline, primary download CTA (auto-detects OS, links to platform-appropriate installer URL pulled from `latest.json`), GitHub link.
2. **Demo GIF** — a recorded `demo.gif` of the press-shortcut → text-pasted flow, embedded inline.
3. **Features grid** — 6 cards: BYOK, multi-provider, multi-platform, open source, auto-update, neobrutalism aesthetic.
4. **Provider showcase** — static logo grid of all 10 supported providers (Q10).
5. **Privacy teaser** — one-paragraph summary of where keys are stored, with link to `/privacy`.
6. **Cross-platform download** — three buttons (Mac DMG, Windows exe, Linux AppImage/deb/rpm) that pull URLs from `latest.json` at build time.
7. **Footer** — GitHub, license (Apache 2.0), version, links to /privacy and /changelog.

**`/privacy`** — full privacy/security explanation:
- BYOK: no Vox Era-hosted backend, your keys go to *your* providers.
- Per-platform secret storage (Keychain / Credential Manager / Secret Service) with honest threat-model paragraph from §6.4.
- Audio: captured by cpal, sent only to the chosen provider, never persisted by Vox Era.
- Telemetry: zero, ever, opt-in only if added.
- History: stored locally in SQLite, rolling 1-year window, user-purgeable.
- Open source link with file paths to the relevant code.

**`/changelog`** — auto-generated from GitHub Releases at build time:
- Build script calls `https://api.github.com/repos/programow/vox-era/releases`, formats the release notes into a chronological list, embeds into the Next.js page.
- Each release entry: version, date, body markdown rendered, download links.
- Static — no runtime fetch.

### 8.3 Hosting

- **AWS S3** bucket `vox-era-prod` in `us-east-1`, public read for site assets.
- **CloudFront** distribution in front of S3 for HTTPS termination, custom domain `vox-era.com` (and `www.vox-era.com` CNAME), edge caching.
- **DNS: Cloudflare** (the user registered the domain there). Cloudflare proxy is OFF (DNS-only / gray cloud) so CloudFront's ACM cert serves SSL directly. ACM cert validation records and apex/www CNAMEs to CloudFront are managed in the same Cloudflare zone.
- **All AWS + Cloudflare resources are provisioned via Pulumi** in `packages/infra/`, not raw CLI. State and secrets are managed by Pulumi Cloud under the personal account `guilherme-vozniak-a-gmail-com` (stack: `guilherme-vozniak-a-gmail-com/vox-era/prod`). AWS provider configured with `profile: 'voxera'`. Cloudflare provider uses an API token stored as a Pulumi-encrypted stack config secret.
- **Single bucket** with prefix layout:
  - `/` — Next.js `out/` deployed here
  - `/updates/latest.json` — Tauri auto-update manifest
  - `/updates/<version>/<platform>/...` — manifest references; actual installers live on GitHub Releases
  - `/apt/` — Debian repository (dists/, pool/, signed Release/InRelease/Packages.gz)
  - `/dnf/` — Fedora repository (repodata/, signed)
  - `/keys/vox-era-releases.gpg` — public GPG key for users to verify packages
  - `/previews/pr-<number>/` — per-PR landing previews (cleaned on PR close)

### 8.4 Deploy pipeline

- **PR previews:** `.github/workflows/pr-preview.yml` builds landing on every PR push, uploads `out/` to `s3://bucket/previews/pr-<num>/`, comments preview URL on PR. Cleans up on PR close.
- **Production:** `.github/workflows/release.yml` (tag-triggered) rebuilds landing with the new `latest.json` URLs and changelog data, deploys to `s3://bucket/`, invalidates CloudFront cache.

---

## 9. Testability architecture

### 9.1 Four layers (per Q12, locked)

| Layer | Scope | Tool | Run when |
|---|---|---|---|
| Unit | Pure functions, no I/O | Vitest, `cargo test --lib` | watch, pre-push, CI |
| Integration | Module + direct deps, mock at I/O boundary | Vitest + MSW, `cargo test` + `wiremock` | pre-push, CI |
| Functional | Full flow inside one process, with audio fixtures | Vitest in jsdom, `cargo test --test functional` | CI (subset pre-push) |
| E2E | Real browser/OS | Playwright (landing only) | CI |

**Desktop E2E explicitly out of scope.** Tauri's `tauri-driver` is too immature on macOS, can't simulate global shortcuts or audio capture. Manual smoke-tests via `/build-clean` cover OS interaction.

### 9.2 Mocking boundaries (the rule: mock at the system boundary, never inside it)

| Boundary | TS test mock | Rust test mock |
|---|---|---|
| HTTP (provider APIs, models endpoints) | MSW v2 (`http` handler API, `setupServer` from `msw/node`) | `wiremock` crate |
| OS keychain | (Rust-side only) | `keyring`'s mock backend / trait swap |
| Clipboard | Trait + mock | Trait + mock |
| Paste simulation (CGEvent / SendInput / xdotool) | (Rust-side only) | Trait + mock |
| Tauri `invoke` | `vi.mock('@tauri-apps/api/core')` | (TS-side only) |
| MediaRecorder | n/a (we use cpal) | (Rust-side) |
| Global shortcut | (Rust-side) | Direct function call |
| File system | `memfs` | `tempfile` crate |
| cpal audio device | (Rust-side) | `MockMicrophoneSource` loads fixture |

### 9.3 Audio fixtures

Location: `packages/desktop/tests/fixtures/audio/`.

| Fixture | Content | Size | Purpose |
|---|---|---|---|
| `hello-world.wav` | "Hello, world." | ~50KB | Happy path |
| `silence.wav` | 2s silence | ~60KB | Edge: no speech |
| `noise.wav` | Background noise, no speech | ~80KB | Edge: noise-only |
| `long-speech.wav` | ~10s multi-sentence | ~300KB | Long-form |
| `multilingual.wav` | Non-English speech | ~150KB | Edge: language detection |

**Provenance:** generated once via OpenAI TTS (license-clean, deterministic). Regeneration script committed at `tests/fixtures/audio/regenerate.ts` for reproducibility. README documents license, voice/model used, and how to regenerate.

### 9.4 Trait-based seams (Rust)

Every OS-touching module exposes a trait + real impl + mock impl:
- `audio::AudioSource` (real: `MicrophoneSource`, mock: `MockMicrophoneSource`)
- `secrets::Vault` (real: `KeyringVault`, mock: `InMemoryVault`)
- `clipboard::Clipboard` (real: `TauriClipboard`, mock: `InMemoryClipboard`)
- `paste::Paster` (real: per-platform paster using `enigo`, mock: `RecordingPaster` that captures the text instead of pasting)
- `history::Repository` (real: `SqliteRepository`, mock: `InMemoryRepository`)

Tauri commands take these traits via dependency injection (held in `tauri::State`). Production wires real impls; tests wire mocks.

### 9.5 Coverage policy

- Goal: **strong regression safety, not a numeric target.**
- Coverage tool: Vitest's v8 coverage for TS, `cargo-llvm-cov` for Rust, output in LCOV combinable in CI.
- Coverage report uploaded as a CI artifact and trend-tracked over time. **Not a hard PR-blocking gate.**
- Explicit exclusions documented in coverage config: Tauri main entry points, `#[cfg(target_os)]` platform-specific OS glue, generated code.

### 9.6 Testcontainers — considered and rejected

No Docker-spinning test containers. Reasoning: our test concerns are HTTP (covered in-process by MSW + wiremock), OS-keychain/clipboard/paste (no container exists), audio (in-process). Testcontainers solves problems we don't have. Documented for future maintainers in `docs/testing.md`.

---

## 10. Tooling, hooks, CI/CD, release

### 10.1 Code quality tools

- **Biome** (`biome.json` at root) — TS/JS lint + format. Replaces ESLint + Prettier. Compatible with React, Next.js. Tailwind class sorting via custom config or `prettier-plugin-tailwindcss` invoked as a separate step.
- **rustfmt** — Rust format (config in `.rustfmt.toml`).
- **clippy** — Rust lint (`-D warnings` to block on lint errors).
- **TypeScript strict mode** in both packages (`tsconfig.json` extends a shared root config).

### 10.2 Lefthook hooks (3-gate pattern, per Q13/Q14)

`lefthook.yml`:
```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: bunx biome check --write {staged_files}
      stage_fixed: true
    rustfmt:
      glob: "*.rs"
      run: rustfmt --check {staged_files}

commit-msg:
  commands:
    commitlint:
      run: bunx commitlint --edit {1}

pre-push:
  parallel: false  # avoid resource contention
  commands:
    typecheck:
      run: bun run typecheck
    lint:
      run: bun run lint
    test-ts:
      run: bun run test:unit && bun run test:integration
    test-rust:
      run: cd packages/desktop/src-tauri && cargo test --lib
```

Target pre-push budget: <60 seconds total.

Excluded from pre-push (CI-only): Playwright, full functional fixtures, multi-platform builds.

### 10.3 GitHub Actions CI (PR gate)

`.github/workflows/ci.yml`:
- **Triggers:** every push to a PR, every push to `main`.
- **Concurrency:** auto-cancel stale runs on new PR pushes.
- **Jobs (run in parallel):**
  - `lint-typecheck` — `ubuntu-latest`, runs Biome + tsc + clippy
  - `test-desktop-mac` — `macos-latest`, runs Vitest + cargo test (full, including functional)
  - `test-desktop-win` — `windows-latest`, same
  - `test-desktop-linux` — `ubuntu-latest`, same
  - `build-desktop-mac` — compiles Tauri (no signing, just verifies it builds)
  - `build-desktop-win` — same
  - `build-desktop-linux` — same, builds AppImage/deb/rpm artifacts (downloadable from PR)
  - `test-landing` — `ubuntu-latest`, Vitest + Playwright against built `out/`
  - `pr-preview-landing` — builds landing, uploads to `s3://bucket/previews/pr-<num>/`, comments preview URL
  - `coverage` — combines LCOV from all test jobs, uploads as artifact

**Branch protection (`main`) — deferred until repo is public or upgraded to Pro:**

The repo stays private through migration. Classic branch protection rules require GitHub Pro on private repos (free for public repos), so setup is deferred. The one-shot `gh api PUT` command is documented in `docs/ci-cd.md` and applied whenever the prerequisite is met. Until then, 2-person honor system: PRs go through CI, neither contributor merges red. When enabled, settings are:

- No direct pushes; PR required.
- Linear history (rebase merge only).
- All listed CI jobs required for merge.
- Dismiss stale reviews on new push.

### 10.4 Release pipeline (tag-triggered)

`.github/workflows/release.yml`, triggered on tag `v*`:

**Build matrix (3 platforms in parallel):**
- macOS: `tauri build` → DMG. Sign with Developer ID from secrets. Notarize via `notarytool`. Staple ticket. Upload DMG.
- Windows: `tauri build` → NSIS installer. **Unsigned** at v1.
- Linux: `tauri build` → AppImage + deb + rpm. GPG-sign deb (`dpkg-sig --sign builder`) and rpm (`rpmsign --addsign`). Upload all three.

**Aggregation steps:**
- Generate `latest.json` (Tauri update manifest) listing platform-specific URLs and minisign signatures. Sign the manifest itself with minisign (private key in secret).
- Update apt repo metadata (`aptly`/`reprepro`) and dnf repo metadata (`createrepo_c`); GPG-sign Release/InRelease and repodata.
- Sync everything to S3:
  - `latest.json` → `s3://bucket/updates/latest.json`
  - apt repo → `s3://bucket/apt/`
  - dnf repo → `s3://bucket/dnf/`
  - public GPG key → `s3://bucket/keys/vox-era-releases.gpg`
- Invalidate CloudFront paths: `/updates/*`, `/apt/*`, `/dnf/*`.
- Create GitHub Release with all installer artifacts attached.
- Rebuild landing with new download URLs and changelog entry; deploy to `s3://bucket/`.

**Required secrets in GitHub** (set via `gh secret set NAME --body "..." --repo programow/vox-era`, not the web UI):
- `APPLE_DEVELOPER_ID_CERT` (base64 of .p12)
- `APPLE_DEVELOPER_ID_PASSWORD` (the .p12 export password)
- `APPLE_API_KEY_ID` (the App Store Connect API key id, e.g., `ABCDE12345`)
- `APPLE_API_KEY_ISSUER` (issuer UUID from App Store Connect)
- `APPLE_API_KEY_CONTENT` (base64 of the .p8 file content)
- `TAURI_UPDATER_PRIVATE_KEY` (minisign)
- `TAURI_UPDATER_PASSPHRASE`
- `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE`
- `AWS_DEPLOY_ROLE_ARN` (OIDC role for GitHub Actions to assume; produced by `pulumi stack output ciRoleArn`)
- `CLOUDFRONT_DISTRIBUTION_ID` (produced by `pulumi stack output distributionId`)

**Notarization key handling in CI:** the Apple App Store Connect API key is a `.p8` file. CI decodes `APPLE_API_KEY_CONTENT` (base64) into a temp file at runtime and sets the env var that `notarytool` (or Tauri's notarization integration) consumes — typically `APPLE_API_KEY_PATH=/tmp/AuthKey_${APPLE_API_KEY_ID}.p8`. Documented in `docs/build-and-release.md`.

**Notarization stapling:** verify whether `tauri build` runs `xcrun stapler staple <path-to-dmg>` automatically; if not, add an explicit post-build step in `release.yml`. Stapling is required so the DMG passes Gatekeeper offline (without the system needing to phone home to Apple).

### 10.5 Release tagging — `/release` slash command

Defined at `.claude/commands/release.md`:
1. Verify on `main`, clean working tree, up to date with origin.
2. Compute next version from conventional commits since last tag (semver: `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major).
3. Generate `CHANGELOG.md` entry from commit messages since last tag.
4. Bump versions in root `package.json`, `packages/desktop/package.json`, `packages/desktop/src-tauri/Cargo.toml`, `packages/desktop/src-tauri/tauri.conf.json`.
5. Create commit `chore(release): vX.Y.Z`.
6. Tag `vX.Y.Z`.
7. Push commit + tag → triggers release workflow.

---

## 11. Distribution & auto-update

### 11.1 Per-platform installers

| Platform | Format | Signing | Distribution |
|---|---|---|---|
| macOS | DMG | Apple Developer ID + notarized | GitHub Releases |
| Windows | NSIS .exe | **Unsigned** (v1) — SmartScreen warning documented | GitHub Releases |
| Linux | AppImage | None (convention) | GitHub Releases |
| Linux | .deb | GPG-signed | GitHub Releases + S3 apt repo |
| Linux | .rpm | GPG-signed | GitHub Releases + S3 dnf repo |

### 11.2 Linux package repositories

**Apt repo install (Debian/Ubuntu):**
```bash
curl -fsSL https://vox-era.com/keys/vox-era-releases.gpg | sudo tee /etc/apt/keyrings/vox-era.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/vox-era.gpg] https://vox-era.com/apt stable main" | sudo tee /etc/apt/sources.list.d/vox-era.list
sudo apt update && sudo apt install vox-era
```

**Dnf repo install (Fedora/RHEL):**
```bash
sudo rpm --import https://vox-era.com/keys/vox-era-releases.gpg
sudo tee /etc/yum.repos.d/vox-era.repo <<EOF
[vox-era]
name=Vox Era Stable
baseurl=https://vox-era.com/dnf
gpgcheck=1
gpgkey=https://vox-era.com/keys/vox-era-releases.gpg
EOF
sudo dnf install vox-era
```

Documented on `/privacy` and `docs/install-linux.md`.

### 11.3 Auto-update

**Library:** `tauri-plugin-updater` (official).

**Manifest (`latest.json`):**
```json
{
    "version": "1.2.3",
    "notes": "Release notes here",
    "pub_date": "2026-05-15T10:00:00Z",
    "platforms": {
        "darwin-x86_64": {
            "signature": "...minisign signature...",
            "url": "https://github.com/programow/vox-era/releases/download/v1.2.3/VoxEra_1.2.3_x64.dmg"
        },
        "darwin-aarch64": { "...": "..." },
        "windows-x86_64": { "...": "..." },
        "linux-x86_64": { "...": "..." }
    }
}
```

**Flow:**
1. App polls `https://vox-era.com/updates/latest.json` on startup + every 4 hours.
2. If `version > current`, prompt user: "Update available: 1.2.3. Notes... [Update] [Later]".
3. User accepts → Tauri downloads platform-appropriate installer → verifies minisign signature against embedded public key → installs (DMG mount-and-replace on Mac, NSIS update on Windows, deb/rpm install via apt/dnf when installed via repo, otherwise manual download for AppImage). The installer URLs in `latest.json` point at GitHub Releases assets; the manifest itself is hosted at `vox-era.com/updates/latest.json` for stable polling.
4. AppImage update path: Tauri's updater downloads the new AppImage and replaces the running file in place; users who installed via apt/dnf get updates through their package manager instead (the in-app updater detects this and points to `apt upgrade vox-era` / `dnf upgrade vox-era`).

**User control:** auto-update on/off toggle in Settings → Updates. "Check now" button forces a poll. Polling interval configurable.

---

## 12. License & privacy

### 12.1 License

**Apache License 2.0.**
- Permissive, OSS-friendly.
- Explicit patent grant from contributors.
- Trademark protection ("Vox Era" name not granted to derivatives).
- File: `LICENSE` at repo root.
- Each source file gets a short header comment with copyright + SPDX identifier (`SPDX-License-Identifier: Apache-2.0`).

### 12.2 Privacy

**v1: zero telemetry. No SDK, no analytics, no error reporting, no usage tracking.**

- Privacy page (§8.2 `/privacy`) documents:
  - Where keys live (per-platform OS keychain) with honest threat-model paragraph.
  - Audio handling (cpal → bytes → chosen provider → discarded).
  - History storage (local SQLite, rolling 1-year, user-purgeable).
  - No Vox Era-hosted services, no analytics, source code linked.
- Privacy is a marketed feature. The landing hero, features grid, and provider-trust page lead with it.

**Future opt-in telemetry (post-v1, if added):**
- Settings toggle defaults **off**.
- If on, only minimal anonymous metrics (app version, platform, basic crash stack — no transcription contents, no provider identity, no model identity, no API key fragments).
- Privacy page updates to document exactly what's sent.
- User can revoke at any time.

---

## 13. AI-assisted development workflow

Vox Era is built and maintained primarily via AI-assisted coding. Workflow tooling is a first-class concern, baked into the spec.

### 13.1 Slash commands (`.claude/commands/`)

Each is a markdown file with YAML frontmatter (`description`) and a body prompt that Claude Code executes.

| Command | Purpose |
|---|---|
| `/dev-desktop` | `bun run dev` in `packages/desktop` (Tauri dev: cargo watch + vite dev) |
| `/dev-landing` | `bun run dev` in `packages/landing` (Next.js dev) |
| `/test` | Run all test suites across both packages (TS + Rust + Playwright) |
| `/test-fast` | Pre-push subset: unit + integration only, no Playwright, no functional fixtures |
| `/typecheck` | `tsc --noEmit` across both packages + `cargo check` |
| `/lint` | `biome check`, `cargo clippy --all-targets -- -D warnings`, `rustfmt --check` |
| `/coverage` | Generate combined LCOV coverage report, open HTML view |
| `/release` | Bump version + changelog + tag + push (triggers release workflow). Verifies clean tree on `main` first. |
| `/add-provider <id>` | Scaffold new provider: create `src/providers/<id>.ts`, append to `PROVIDERS` array in `index.ts`, scaffold test file with the standard provider contract test, **and update `docs/providers.md` + provider grid in landing**. |
| `/build-clean` | Local clean build of desktop app: clean dist, build, sign, install, verify. Updated for Tauri. |
| `/diagnose` | Read-only diagnostic: check permissions per platform, verify configured providers, check DB state, check current version vs `latest.json`. |
| `/reset-perms` | macOS-only: `tccutil reset Microphone com.vhtechnology.voxera`. Documented as last-resort. |
| `/sync-docs` | Audit pass: scan changes since last commit, identify which docs need updating per the trigger table in §5.1, propose patches. Run before opening a PR. |

### 13.2 Documentation (`docs/`)

| File | Content |
|---|---|
| `README.md` (root) | What Vox Era is, install instructions per OS, link to docs/ and `vox-era.com` |
| `CLAUDE.md` (root) | Top-level AI dev guide: monorepo overview, where things live, common workflows, link to all `docs/` entries, slash commands inventory |
| `CONTRIBUTING.md` | Branching model, conventional commits, testing rules, hook bypass policy |
| `LICENSE` | Apache 2.0 text |
| `docs/README.md` | Index of all docs |
| `docs/architecture.md` | Process model, monorepo layout, Tauri command surface, sequence diagrams |
| `docs/testing.md` | 4-layer architecture, mocking boundaries, fixtures, when to write what kind of test |
| `docs/providers.md` | How to add a new STT provider step-by-step (refs `/add-provider`) |
| `docs/permissions.md` | Per-platform mic permission flow, what each state means, how to recover |
| `docs/secrets.md` | Per-platform secret storage details, threat model |
| `docs/build-and-release.md` | Local build, signing setup, release workflow walkthrough |
| `docs/ci-cd.md` | GitHub Actions overview, branch protection, PR previews |
| `docs/install-linux.md` | Apt/dnf repo setup instructions for end-users |
| `docs/troubleshooting.md` | Symptom-keyed punch list (mic not working, paste fails, app won't update, etc.) |
| `docs/development-workflow.md` | When to use which slash command |
| `packages/desktop/README.md` | Package-level: Tauri specifics, frontend/backend boundary, where to add features |
| `packages/landing/README.md` | Package-level: Next.js specifics, deploy preview workflow |

### 13.3 Skills

Vox Era's repo references the [Anthropic superpowers skills](https://github.com/anthropics/superpowers) (already available in user's environment). `CLAUDE.md` lists which skills naturally apply for which workflows:
- `superpowers:brainstorming` — for new features
- `superpowers:writing-plans` — for breaking design into tasks
- `superpowers:subagent-driven-development` — for executing tasks via subagents
- `superpowers:test-driven-development` — for adding new functionality

### 13.4 Configuration files

| File | Purpose |
|---|---|
| `biome.json` | Lint + format rules |
| `lefthook.yml` | Hook orchestration |
| `commitlint.config.js` | Conventional commits rule set |
| `.rustfmt.toml` | Rust format config |
| `tsconfig.base.json` | Shared strict TS config (extended by per-package configs) |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR description template (summary / test plan / breaking changes) |
| `.github/CODEOWNERS` | (single owner: user) — kept for future contributors |

---

## 14. Branding

Final naming:

| Surface | Value | Notes |
|---|---|---|
| Display name | **Vox Era** | Two words, capitalized. Use everywhere user-visible. |
| URL slug | `vox-era` | Hyphenated; used in domain, GitHub repo, npm scope, file paths, GPG key file name. |
| Identifier (no hyphens) | `voxera` | Used where hyphens are disallowed or discouraged: macOS bundle id, Cargo crate name, internal symbol names. |
| Domain | `vox-era.com` | Primary site + auto-update manifest + apt/dnf repos. `www.vox-era.com` redirects to apex. |
| GitHub repo | `programow/vox-era` | |
| macOS bundle id | `com.vhtechnology.voxera` | |
| npm scope | `@vox-era` | Packages: `@vox-era/desktop`, `@vox-era/landing`. |
| Cargo crate | `voxera` | In `packages/desktop/src-tauri/Cargo.toml`. |
| Linux package name | `vox-era` | The deb/rpm package id; `apt install vox-era`. |
| Service/account in OS keychain | `vox-era` (service), `<provider-id>` (account) | |
| App data dir | `com.vhtechnology.voxera/` | Tauri's `app_data_dir()` resolves under the bundle id on each OS. |
| SQLite db file | `vox-era.db` | |
| GPG key file | `vox-era-releases.gpg` | Hosted at `vox-era.com/keys/`. |
| Apt sources file (user installs) | `/etc/apt/sources.list.d/vox-era.list` | |
| Dnf repo file | `/etc/yum.repos.d/vox-era.repo` | |

**Migration of legacy strings:** the existing Electron codebase uses `Ada`, `ada`, `com.programow.ada`. These are removed entirely in Phase 4 (the legacy folder gets deleted). No backwards-compatibility renaming is needed since the Electron app was never released to users — there's no installed base to migrate.

---

## 15. v1 feature inventory (final)

**Desktop app:**
- Global hotkey toggles recording (default: **Fn on macOS** via `CGEventTap` + Accessibility permission; **Ctrl+Shift+Space on Windows/Linux** via `tauri-plugin-global-shortcut`; user-configurable)
- Mic capture via cpal (cross-platform), mono 16kHz wav output
- Permission UX with deep links per platform: Microphone (always required) + Accessibility (required for Fn-key shortcut on macOS)
- 9 STT providers via AI SDK (AssemblyAI, Azure OpenAI, Deepgram, ElevenLabs, Fal, Gladia, Groq, OpenAI, Rev.ai)
- Per-provider model fetching where API supports it; hardcoded list fallback; free-text override
- API keys stored in OS keychain, fetched just-in-time
- Transcription history in SQLite (with `provider_id` and `model_id` per row), rolling 1-year retention default, user-configurable + manual purge
- **Stats dashboard:** total words (lifetime/week/month), streak (consecutive days), avg WPM, time saved (vs 45 WPM typing baseline), top provider, top model, **estimated cost** (lifetime/week/month, total + per-provider breakdown, with rates sourced from per-provider config and a transparent "how is this calculated?" tooltip)
- Tray icon with menu (status, provider switch, open Vox Era, quit)
- Main window: Dashboard / History / Settings / About tabs
- Bottom-center overlay pill: recording state, click to expand for quick actions
- Auto-update via signed S3 manifest, user-toggleable
- Themes: light / dark / system, accent color picker (neobrutal palette)
- Apache 2.0 license, zero telemetry

**Landing page:**
- Hero + demo GIF + features + provider grid + privacy teaser + downloads + footer
- `/privacy` — full security explanation
- `/changelog` — auto-generated from GitHub Releases
- shadcn/ui via neobrutalism.dev variants, Tailwind, Next.js static export to S3 + CloudFront

**Tooling/CI/release:**
- Bun monorepo, Biome, Lefthook, commitlint conventional commits
- 4-layer testing (Vitest + cargo + Playwright)
- GitHub Actions: PR CI matrix (mac/win/linux), PR previews of landing, tag-triggered release
- Signed: macOS DMG (Apple Developer ID + notarized), Linux deb/rpm (GPG)
- Unsigned at v1: Windows NSIS
- Linux apt + dnf repos self-hosted on S3

**AI-assisted dev workflow:**
- 11 slash commands
- 14 docs pages
- Skill references in CLAUDE.md
- Per-package READMEs

---

## 16. Out of scope / deferred (v2+)

Documented here so future-us doesn't accidentally re-derive these.

| Feature | Reason for deferral |
|---|---|
| System audio loopback | Per-platform native code (ScreenCaptureKit/WASAPI/PipeWire); deserves its own design phase. `AudioSource` trait already accommodates it. |
| Dictionary / inline correction / term biasing | Multi-week subsystem; needs OS-text-selection access per platform; provider support varies (Whisper `prompt`, Deepgram `keywords`, etc.). |
| Master passphrase / vault lock | Defense-in-depth, but adds friction to every transcription; unnecessary while keychain ACL is sufficient. |
| Telemetry | Opt-in only when added; v1 ships with no SDK. |
| Mobile (iOS / Android) | Different runtime, different permission models, different stores. |
| E2E tests of the desktop app | Tauri E2E tooling immature. Functional layer covers integration. |
| Flatpak distribution | Flathub submission + manifest; defer until Linux user demand justifies. |
| Snap distribution | Snap Store submission; defer same as Flatpak. |
| AUR (Arch) | Community-maintained PKGBUILD; doc says "PRs welcome." |
| Homebrew tap | Community-maintained formula; doc says "PRs welcome." |
| Cloudsmith / Packagecloud | Self-hosted apt+dnf on S3 is durable and avoids third-party lock-in. |
| Testcontainers | No Docker-target dependencies in our stack. |
| Windows code signing | Defer until download volume justifies cost; OV cert builds SmartScreen reputation slowly anyway. |
| Streaming transcription | AI SDK supports it for some providers; v1 is non-streaming for simplicity. |
| Multi-language UI | English-only at v1; i18n architecture not yet designed. |

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pulumi Cloud account loss / takeover | Pulumi Cloud retains state history per stack, so accidental destructive `pulumi up`s can be reverted with `pulumi stack history` + `pulumi stack export/import`. The personal Pulumi account uses 2FA (mandatory for any maintainer with write access). For a worst-case account loss, `pulumi stack export` is captured as a release-time CI artifact so we always have an offline copy. CI authenticates via a `PULUMI_ACCESS_TOKEN` GitHub Secret which is rotatable independently of the account password. |
| Cloudflare API token compromise | Token is scoped to `vox-era.com` zone only with Zone:Read + DNS:Edit (no account-level perms). Rotation: generate new token, `pulumi config set --secret cloudflareApiToken <new>`, `pulumi up` (no resource churn), revoke old token in Cloudflare. |
| AI SDK STT provider list churns (provider added/removed/renamed) | Per-provider adapter is one isolated file; updates are PR-sized. Validated against current docs at spec time; expect drift over months. |
| `experimental_transcribe` may rename when it graduates from experimental | Single import in `src/lib/transcribe.ts`; rename is a one-line change + test update. Track AI SDK release notes in `dependabot` PRs. |
| Provider pricing changes silently — cost estimates drift | Each provider's `pricing` field has a `lastUpdated` ISO date. Quarterly audit task tracked as recurring TODO in `docs/providers.md`. UI surfaces "estimated" with the date prominently to set user expectations. Wrong estimate is better than no estimate; "actual billing may vary" disclaimer is always shown. |
| `CGEventTap` for Fn-key shortcut sees all keystrokes | Privacy page documents what the tap reads (modifier flags only) and doesn't (key codes, content). Code is open source, file path linked. User can switch off Fn shortcut at any time. Accessibility permission is the user's authorization. |
| Accessibility permission denied or revoked | App detects and falls back to a non-Fn combo with a clear banner. Documented in `docs/troubleshooting.md`. Settings UI shows current Accessibility state and a "Re-grant" button. |
| Tauri 2.x API still evolving | Pin Tauri version in `Cargo.toml`; track upstream releases via dependabot; spec major upgrades as separate work. |
| `cpal` device handling on Linux is variable (PipeWire vs PulseAudio vs ALSA) | cpal's ALSA backend works on all three via PulseAudio's ALSA emulation; document the prerequisite. |
| Windows registry path for mic permission is undocumented Microsoft territory | Tested per Windows version during smoke testing; fall back to a graceful error if registry read fails. Verified at `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\NonPackaged\<exe-path>\Value`; key path may shift in future Windows versions. |
| macOS deep-link URL for Privacy & Security panel may differ on Ventura+ (System Settings rebrand) | Spec uses `x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone`; on macOS 13+ this should still work but verify on a current macOS during implementation; the canonical URL may now be `x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone`. |
| Windows SmartScreen warning hurts adoption | Document prominently in `/privacy` and download page; revisit OV cert in v2 once download counts justify. |
| Apple Developer cert expires | Annual renewal reminder; CI fails fast with clear error if cert is invalid. |
| GitHub Releases API rate limit hits during landing build | Build-time fetch happens once per release; generous cache; falls back to most-recent-known if rate limited. |
| Tauri auto-update minisign key compromise | Documented rotation procedure; old key kept as trusted-fallback for one release cycle to allow updates to a new key. |
| User runs Linux without secret-service available | Clear startup error with install instructions; defer file-based encrypted fallback to v2. |

---

## 18. Open items (to confirm before / during implementation)

1. **Domain registration.** Domain `vox-era.com` is registered at **Cloudflare** (DNS provider). The Cloudflare zone id is captured in Plan D Task 4 Step 3 and stored in Pulumi stack config.
2. **GitHub repo creation.** Repo renamed `programow/ada` → `programow/vox-era` in Plan A Task 20 (preserves history, stars, redirects). Repo stays **private** through migration; branch protection deferred until the repo is made public (free-tier limitation on private repos).
3. **GPG keypair generation.** Manual one-time step in Plan D Task 1 (~15 min). Private key + passphrase pushed to GitHub Secrets via `gh secret set`.
4. **Apple Developer credentials.** User has the account. .p12 cert + App Store Connect API key (.p8) base64-encoded and pushed to GitHub Secrets in Plan D Task 3.
5. **Tauri minisign keypair.** Generated via `bunx @tauri-apps/cli signer generate` in Plan D Task 2. Public key embedded in `tauri.conf.json`; private key + passphrase to GitHub Secrets.
6. **Cloudflare API token.** Generated manually at `https://dash.cloudflare.com/profile/api-tokens` with Zone:Read + DNS:Edit scope for the `vox-era.com` zone (Plan D Task 4 Step 2). Stored as a Pulumi-encrypted stack config secret (`pulumi config set --secret cloudflareApiToken ...`).
7. **Pulumi Cloud login (one-time).** `pulumi login` (the user is already authenticated under personal account `guilherme-vozniak-a-gmail-com`); CI uses a long-lived `PULUMI_ACCESS_TOKEN` from `https://app.pulumi.com/account/tokens` (Plan D Task 4 Step 1). No AWS state bucket or KMS key needed — Pulumi Cloud manages state and secrets server-side.
8. **AWS infrastructure provisioning via Pulumi.** S3 site bucket `vox-era-prod`, CloudFront distribution, ACM cert (DNS-validated via Cloudflare records), IAM OIDC provider + `vox-era-ci` role, plus Cloudflare DNS records (apex, www, validation) all defined in `packages/infra/index.ts` (Plan D Task 5).
9. **Additional features the user mentioned post-spec.** User said: "after we ported the application and get rid of the old application, I should mention to you the features, and you should review to see if we need to adjust anything in our plan." This spec covers the migration baseline. Once the user mentions new features, we re-review this spec and adjust before transitioning to the implementation plan.

---

## 19. References

All URLs validated 2026-05-03. Re-validate at implementation time if it's been more than a few months — several of these projects (Tauri 2.x, AI SDK transcribe, neobrutalism components, keyring v3 → v4) iterate quickly.

**Core stack:**
- [Tauri 2.x docs](https://tauri.app/) — desktop app framework
- [Tauri capabilities](https://tauri.app/security/capabilities/) — the per-plugin permission model (replaces Tauri 1's allowlist)
- [Tauri commands (Rust ↔ JS)](https://tauri.app/develop/calling-rust/)
- [Tauri config reference (`MacConfig`, `BundleConfig`)](https://tauri.app/reference/config/)
- [Tauri distribute (signing, notarization, packaging)](https://tauri.app/distribute/)
- [Tauri macOS code signing](https://tauri.app/distribute/sign/macos/)
- [Tauri system tray](https://tauri.app/learn/system-tray/)
- [Tauri window customization](https://tauri.app/learn/window-customization/)

**Tauri plugins:**
- [`tauri-plugin-updater`](https://tauri.app/plugin/updater/) — official auto-update (minisign-signed manifests)
- [`tauri-plugin-sql`](https://tauri.app/plugin/sql/) — sqlx-backed SQLite via JS commands
- [`tauri-plugin-store`](https://tauri.app/plugin/store/) — JSON key-value preferences
- [`tauri-plugin-global-shortcut`](https://tauri.app/plugin/global-shortcut/) — hotkey registration
- [`tauri-plugin-clipboard-manager`](https://tauri.app/plugin/clipboard-manager/) — clipboard read/write with permission scoping

**STT & LLM SDK:**
- [Vercel AI SDK](https://ai-sdk.dev) — provider-agnostic AI orchestration
- [AI SDK transcription docs](https://ai-sdk.dev/docs/ai-sdk-core/transcription) — `experimental_transcribe`, supported providers

**Rust crates:**
- [`keyring` v3.x](https://docs.rs/keyring/3.6.2/keyring/) — cross-platform credential storage with built-in mock backend
- [`cpal`](https://docs.rs/cpal/latest/cpal/) — cross-platform audio I/O (CoreAudio / WASAPI / ALSA)
- [`enigo`](https://docs.rs/enigo) — cross-platform synthetic input (paste simulation)
- [`zeroize`](https://docs.rs/zeroize) — memory wiping for secrets
- [`objc2`](https://docs.rs/objc2) — Rust bindings to Objective-C runtime (used for `AVCaptureDevice.requestAccess`)

**Frontend & landing:**
- [shadcn/ui installation](https://ui.shadcn.com/docs/installation) — CLI is `shadcn@latest`
- [neobrutalism.dev](https://www.neobrutalism.dev/docs/installation) — shadcn-based neobrutalism component variants
- [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) — `output: "export"` for SSG
- [Tailwind CSS](https://tailwindcss.com/docs)

**Testing:**
- [Vitest](https://vitest.dev/)
- [MSW v2 migration guide](https://mswjs.io/docs/migrations/1.x-to-2.x) — use `http` not `rest`, `setupServer` from `msw/node`
- [Playwright](https://playwright.dev/)
- [`cargo-llvm-cov`](https://github.com/taiki-e/cargo-llvm-cov)
- [`wiremock` crate](https://docs.rs/wiremock)

**Tooling & process:**
- [Biome CLI reference](https://biomejs.dev/reference/cli/) — `--write` (not `--apply`); `--staged` flag exists
- [Biome's lefthook recipe](https://biomejs.dev/recipes/git-hooks/) — the canonical pre-commit pattern we follow
- [Lefthook configuration](https://lefthook.dev/configuration/) — hook syntax, placeholders
- [commitlint](https://github.com/conventional-changelog/commitlint) — `@commitlint/cli` + `@commitlint/config-conventional`
- [Conventional Commits 1.0](https://www.conventionalcommits.org/)
- [Anthropic Superpowers skills](https://github.com/anthropics/superpowers)

**Distribution & infra:**
- [`aptly`](https://www.aptly.info/) — apt repo metadata generator
- [`createrepo_c`](https://github.com/rpm-software-management/createrepo_c) — dnf/yum repo metadata generator
- [Apple notarytool](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) — current notarization tool (replaced `altool` ~2023)
- [GitHub Actions for AWS via OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-guides/configuring-openid-connect-in-amazon-web-services)

**License:**
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
