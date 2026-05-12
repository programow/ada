# CLAUDE.md

AI dev workflow guide for Vox Era — a cross-platform speech-to-text desktop app, currently migrating from Electron (legacy) to Tauri.

## What Vox Era is

**Vox Era** is the new Tauri-based version of what was originally **Ada** (a macOS-only Electron app). The migration is in flight on branch `execution` (branched from `tech-stack` at the start of Plan A; final PR `execution` → `main` lives at the end of Plan D). The legacy Electron app lives under `legacy/electron/` for reference and is removed at the end of Plan D.

- **Display name:** Vox Era
- **URL slug:** `vox-era`
- **Identifier (no hyphens):** `voxera` (used for Cargo crate name and macOS bundle id `com.vhtechnology.voxera`)
- **Domain:** `vox-era.com`
- **GitHub repo:** `programow/vox-era`
- **License:** Apache 2.0

## Monorepo layout

```
vox-era/
├── packages/
│   ├── desktop/    # Tauri app: Rust backend + React webview
│   ├── landing/    # Next.js static landing page
│   └── infra/      # Pulumi IaC: AWS + Cloudflare DNS
├── legacy/electron/  # Archived Ada Electron app (removed in Plan D)
├── docs/             # Long-form documentation
├── .claude/commands/ # Slash commands
├── .github/workflows/ # CI/CD
└── [root tooling: package.json, biome.json, lefthook.yml, commitlint.config.js, tsconfig.base.json]
```

## Workflows

- **Develop desktop app:** `/dev-desktop` (implemented in Plan B)
- **Develop landing page:** `/dev-landing` (implemented in Plan C)
- **Run all tests:** `/test` (Plan B)
- **Pre-push subset:** `/test-fast` (Plan B)
- **Typecheck everything:** `/typecheck` (Plan B/C)
- **Lint everything:** `/lint`
- **Build a clean signed desktop binary locally:** `/build-clean` (Plan B; signing in Plan D)
- **Diagnose desktop app state:** `/diagnose` (Plan B)
- **Macros: reset macOS permissions:** `/reset-perms` (Plan B)
- **Add a new STT provider:** `/add-provider <id>` (Plan B)
- **Audit doc updates needed for current changes:** `/sync-docs`
- **Cut a release:** `/release` (Plan D)

## Conventions

- **Branching:** PRs are the expected workflow so CI runs and the diff is reviewable. `main` is not GitHub-protected (deferred until the repo goes public or upgrades to Pro — see `docs/ci-cd.md` for the one-shot enable command). Linear history (rebase merge) is convention, not enforced.
- **Commits:** Conventional Commits 1.0 — enforced via lefthook + commitlint. Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `build`, `ci`, `refactor`, `perf`, `style`, `revert`
- **Test discipline:** strict TDD. Failing test first, then minimal implementation. Per the spec's 4-layer testability architecture (unit / integration / functional / E2E)
- **Doc discipline:** if a change matches a row in the documentation update trigger table (spec §5.1, mirrored in `CONTRIBUTING.md`), the same PR updates the affected docs
- **Hooks:** pre-commit fast & cosmetic; commit-msg blocks non-conventional; pre-push runs typecheck + lint + tests. CI runs the full matrix.

## Skills (when working on this repo)

Vox Era references the [Anthropic superpowers skills](https://github.com/anthropics/superpowers) (already available in your environment) PLUS four project-local skills in `.claude/skills/` that document tooling specifics for this codebase. Project-local skills auto-activate when their description matches the task at hand.

**Superpowers (workflow process):**
- `superpowers:brainstorming` — when starting a new feature
- `superpowers:writing-plans` — to break a design into tasks
- `superpowers:subagent-driven-development` — to execute a plan task-by-task
- `superpowers:test-driven-development` — the discipline subagents follow per task

**Project-local (tooling reference):**
- `tauri-2-app-development` — capabilities, plugins, multi-window, macOS Info.plist gotchas
- `pulumi-cloud-iac` — Pulumi Cloud state + secrets, AWS profile, Cloudflare provider
- `tauri-release-and-distribution` — Apple notarization, minisign updater, GPG-signed apt/dnf repos
- `ai-sdk-transcribe` — `experimental_transcribe`, provider factory pattern, MSW v2 mocking

## Documentation index

See [`docs/README.md`](./docs/README.md) for the full doc index. Quick links once they exist:

- [`docs/architecture.md`](./docs/architecture.md) — process model, command surface, sequence diagrams (Plan B)
- [`docs/testing.md`](./docs/testing.md) — the 4-layer architecture and audio fixtures (Plan B)
- [`docs/permissions.md`](./docs/permissions.md) — mic + Accessibility flow per platform (Plan B)
- [`docs/secrets.md`](./docs/secrets.md) — keychain backend per platform, threat model (Plan B)
- [`docs/providers.md`](./docs/providers.md) — how to add an STT provider (Plan B)
- [`docs/build-and-release.md`](./docs/build-and-release.md) — local build + signing + release workflow (Plan D)
- [`docs/install-linux.md`](./docs/install-linux.md) — apt + dnf user install instructions (Plan D)
- [`docs/ci-cd.md`](./docs/ci-cd.md) — GitHub Actions overview, branch protection, OIDC (Plan D)
- [`docs/troubleshooting.md`](./docs/troubleshooting.md) — symptom-keyed punch list (Plan D)
