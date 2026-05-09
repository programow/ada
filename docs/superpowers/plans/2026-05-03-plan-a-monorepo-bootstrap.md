# Vox Era — Plan A: Monorepo Bootstrap & Tooling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a Bun-based monorepo with Biome, Lefthook, commitlint, base CI, root docs, Apache 2.0 license, and renamed GitHub repo — ready for Plans B (desktop app), C (landing page), and D (infra + release) to add their packages.

**Architecture:** Single Bun workspace at repo root with three empty package skeletons (`packages/desktop`, `packages/landing`, `packages/infra`). Existing Electron files move to `legacy/electron/` for reference until Plan D removes them. Tooling runs at root, applies workspace-wide. Conventional commits enforced via commitlint on `commit-msg` hook. Biome handles lint+format on staged files via lefthook `pre-commit`. Pre-push runs typecheck + lint at root.

**Tech Stack:** Bun (workspaces), Biome (lint+format), Lefthook (hooks), commitlint (`@commitlint/cli` + `@commitlint/config-conventional`), GitHub Actions (lint+typecheck CI), Apache 2.0 license.

**Depends on:** Nothing (foundation plan).
**Blocks:** Plans B, C, D.

---

## Section 1: Pre-flight & legacy archive

### Task 1: Pre-flight checks + create the `execution` branch

**Files:** none (verification + branch creation; skills commit if present)

**Steps:**

- [ ] **Step 1: Verify on `tech-stack` (parent branch)**

Run: `git status && git rev-parse --abbrev-ref HEAD`
Expected: current branch is `tech-stack`. Working tree may have uncommitted `.claude/skills/` files from the planning session — those get committed in Step 5. If not on `tech-stack`, switch with `git switch tech-stack` or stop and ask.

- [ ] **Step 2: Verify spec file exists**

Run: `test -f docs/superpowers/specs/2026-05-03-vox-era-tauri-monorepo-design.md && echo OK || echo MISSING`
Expected: `OK`

- [ ] **Step 3: Verify legacy Electron files are present**

Run: `ls -1 main.js preload.js renderer.js index.html paste-helper paste-helper.swift entitlements.plist 2>&1`
Expected: each file listed with no "No such file" errors.

- [ ] **Step 4: Create the `execution` branch from `tech-stack` and switch to it**

```bash
git switch -c execution
```
Expected: "Switched to a new branch 'execution'". All subsequent Plan A tasks (and Plans B/C/D) commit to `execution`. The final PR (Plan D Task 19) merges `execution` → `main`. The `tech-stack` branch is preserved as the planning/spec record and receives no implementation commits.

- [ ] **Step 5: Commit pre-existing project-local skills if uncommitted**

The planning session may have left `.claude/skills/{tauri-2-app-development, pulumi-self-hosted-iac, tauri-release-and-distribution, ai-sdk-transcribe}/SKILL.md` as uncommitted files in the working tree. Commit them now so they travel with `execution`:

```bash
if [ -n "$(git status --porcelain .claude/skills/ 2>/dev/null)" ]; then
  git add .claude/skills/
  git commit -m "feat(claude): add project-local skills for tooling reference"
fi
```
Expected: either the skills commit lands, or no-op if they were already committed.

---

### Task 2: Move legacy Electron files to `legacy/electron/`

**Files:**
- Create: `legacy/electron/` directory
- Move (`git mv`): `main.js`, `preload.js`, `renderer.js`, `index.html`, `paste-helper`, `paste-helper.swift`, `entitlements.plist`, `dashboard.html`, `trayIconTemplate.png`, `trayIconTemplate@2x.png`, `package.json`, `package-lock.json` → `legacy/electron/`
- Create: `legacy/electron/README.md`

**Steps:**

- [ ] **Step 1: Create the directory and move files**

```bash
mkdir -p legacy/electron
git mv main.js preload.js renderer.js index.html legacy/electron/
git mv paste-helper paste-helper.swift entitlements.plist legacy/electron/
git mv dashboard.html trayIconTemplate.png trayIconTemplate@2x.png legacy/electron/
git mv package.json legacy/electron/package.json
git mv package-lock.json legacy/electron/package-lock.json
```

- [ ] **Step 2: Add a README explaining the legacy folder**

Create `legacy/electron/README.md`:

```markdown
# Legacy Electron Ada

This folder contains the original macOS-only Electron speech-to-text app, preserved as a reference during the Tauri migration.

**Status:** archived, not actively maintained. Vox Era is the supported app at `packages/desktop/` once Plan B ships.

**Original config:** macOS DMG via electron-builder, signed via Apple Developer ID, paste via `paste-helper.swift`. See git history for build instructions.

**Removal:** this directory will be deleted at the end of Plan D once Vox Era reaches feature parity (per spec §5 Phase 4).

**Run the legacy app (if needed for behavior comparison):**

```bash
cd legacy/electron
npm install
npm start
```

(Note: requires the original `config.json` with an OpenAI API key.)
```

- [ ] **Step 3: Verify**

Run: `ls legacy/electron/ && ls -1 *.js *.html paste-helper* 2>&1 | grep -v 'No such' || echo 'root cleaned'`
Expected: legacy/electron/ has all files; no Electron files remain at root.

- [ ] **Step 4: Commit**

```bash
git add legacy/
git commit -m "chore: archive legacy Electron app under legacy/electron/"
```

---

## Section 2: Root tooling configuration

### Task 3: Root `package.json` with Bun workspaces

**Files:**
- Create: `package.json` (new, at repo root)

**Steps:**

- [ ] **Step 1: Create the new root `package.json`**

```json
{
  "name": "vox-era",
  "private": true,
  "version": "0.0.0",
  "description": "Vox Era — cross-platform speech-to-text desktop app with multi-provider STT",
  "license": "Apache-2.0",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "bun run --filter '*' test",
    "test:unit": "bun run --filter '*' test:unit",
    "test:integration": "bun run --filter '*' test:integration",
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "lefthook": "^1.7.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `bun install`
Expected: `bun.lockb` created; `node_modules/` populated; no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "feat: root package.json with Bun workspaces and dev tooling"
```

---

### Task 4: Empty package skeletons

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/landing/package.json`
- Create: `packages/infra/package.json`
- Create: `packages/desktop/.gitkeep`
- Create: `packages/landing/.gitkeep`
- Create: `packages/infra/.gitkeep`

**Steps:**

- [ ] **Step 1: Create `packages/desktop/package.json`**

```json
{
  "name": "@vox-era/desktop",
  "private": true,
  "version": "0.0.0",
  "description": "Vox Era desktop app (Tauri 2.x) — implementation in Plan B",
  "scripts": {
    "typecheck": "echo 'desktop typecheck — implemented in Plan B' && exit 0",
    "test": "echo 'desktop test — implemented in Plan B' && exit 0",
    "test:unit": "echo 'desktop test:unit — implemented in Plan B' && exit 0",
    "test:integration": "echo 'desktop test:integration — implemented in Plan B' && exit 0"
  }
}
```

- [ ] **Step 2: Create `packages/landing/package.json`**

```json
{
  "name": "@vox-era/landing",
  "private": true,
  "version": "0.0.0",
  "description": "Vox Era landing page (Next.js static) — implementation in Plan C",
  "scripts": {
    "typecheck": "echo 'landing typecheck — implemented in Plan C' && exit 0",
    "test": "echo 'landing test — implemented in Plan C' && exit 0",
    "test:unit": "echo 'landing test:unit — implemented in Plan C' && exit 0",
    "test:integration": "echo 'landing test:integration — implemented in Plan C' && exit 0"
  }
}
```

- [ ] **Step 3: Create `packages/infra/package.json`**

```json
{
  "name": "@vox-era/infra",
  "private": true,
  "version": "0.0.0",
  "description": "Vox Era infrastructure as code (Pulumi + AWS + Cloudflare) — implementation in Plan D",
  "scripts": {
    "typecheck": "echo 'infra typecheck — implemented in Plan D' && exit 0",
    "test": "echo 'infra test — no tests for IaC' && exit 0",
    "test:unit": "echo 'infra test:unit — no tests for IaC' && exit 0",
    "test:integration": "echo 'infra test:integration — no tests for IaC' && exit 0"
  }
}
```

- [ ] **Step 4: Add `.gitkeep` files so empty package directories are tracked**

```bash
touch packages/desktop/.gitkeep packages/landing/.gitkeep packages/infra/.gitkeep
```

- [ ] **Step 5: Verify workspace recognition**

Run: `bun install`
Expected: bun recognizes `@vox-era/desktop`, `@vox-era/landing`, and `@vox-era/infra` as workspaces; no errors.

Run: `bun run typecheck`
Expected: all three placeholder echoes print without error.

- [ ] **Step 6: Commit**

```bash
git add packages/
git commit -m "feat: add empty package skeletons for desktop, landing, and infra"
```

---

### Task 5: Shared TypeScript base config

**Files:**
- Create: `tsconfig.base.json`

**Steps:**

- [ ] **Step 1: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "jsx": "preserve"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "feat: add shared strict TypeScript base config"
```

---

### Task 6: Biome configuration

**Files:**
- Create: `biome.json`

**Steps:**

- [ ] **Step 1: Create `biome.json`**

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": [
      "**/dist",
      "**/out",
      "**/build",
      "**/.next",
      "**/target",
      "**/node_modules",
      "legacy/**",
      "docs/superpowers/**",
      "**/*.lock",
      "**/bun.lockb"
    ]
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useNodejsImportProtocol": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 4,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "json": {
    "formatter": {
      "indentWidth": 2
    }
  }
}
```

- [ ] **Step 2: Verify Biome runs without errors against the empty workspace**

Run: `bunx biome check .`
Expected: no errors (may warn on empty workspaces; that's fine).

- [ ] **Step 3: Commit**

```bash
git add biome.json
git commit -m "feat: add Biome lint+format config"
```

---

### Task 7: commitlint configuration

**Files:**
- Create: `commitlint.config.js`

**Steps:**

- [ ] **Step 1: Create `commitlint.config.js`**

```js
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 100],
        'body-max-line-length': [2, 'always', 200],
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'chore',
                'docs',
                'test',
                'build',
                'ci',
                'refactor',
                'perf',
                'style',
                'revert',
            ],
        ],
    },
};
```

- [ ] **Step 2: Verify commitlint accepts a sample message**

Run: `echo "feat: sample" | bunx commitlint`
Expected: exit 0, no output.

Run: `echo "random commit message" | bunx commitlint`
Expected: exit non-zero with error "subject may not be empty" or "type may not be empty".

- [ ] **Step 3: Commit**

```bash
git add commitlint.config.js
git commit -m "feat: add commitlint config enforcing conventional commits"
```

---

### Task 8: Lefthook configuration

**Files:**
- Create: `lefthook.yml`

**Steps:**

- [ ] **Step 1: Create `lefthook.yml`**

```yaml
# Vox Era hook orchestration. Three gates per spec §10.2.
# - pre-commit: cosmetic, fast, staged-files only
# - commit-msg: conventional commits enforcement
# - pre-push: correctness checks (typecheck + lint at root; test runs once packages exist)

pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json,jsonc}"
      run: bunx biome check --write {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: bunx commitlint --edit {1}

pre-push:
  parallel: false
  commands:
    lint:
      run: bun run lint
    typecheck:
      run: bun run typecheck
```

- [ ] **Step 2: Install lefthook locally**

Run: `bunx lefthook install`
Expected: "sync hooks: ✓" output; `.git/hooks/pre-commit`, `.git/hooks/commit-msg`, `.git/hooks/pre-push` files created.

- [ ] **Step 3: Verify the commit-msg hook rejects non-conventional commits**

Run:
```bash
echo "banana commit" > /tmp/test-msg.txt
bunx lefthook run commit-msg --force /tmp/test-msg.txt
```
Expected: exit non-zero with commitlint error.

Run:
```bash
echo "feat: sample" > /tmp/test-msg.txt
bunx lefthook run commit-msg --force /tmp/test-msg.txt
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lefthook.yml
git commit -m "feat: add lefthook hooks for pre-commit, commit-msg, pre-push"
```

---

### Task 9: Update `.gitignore` for monorepo

**Files:**
- Modify: `.gitignore` (replace contents)

**Steps:**

- [ ] **Step 1: Replace `.gitignore` content**

```gitignore
# Dependencies
node_modules/

# Build outputs
packages/*/dist/
packages/*/out/
packages/*/build/
packages/*/.next/
packages/desktop/src-tauri/target/
dist/

# Test artifacts
coverage/
.nyc_output/
playwright-report/
blob-report/
playwright/.cache/
*.lcov

# Editor + OS
.DS_Store
.vscode/
.idea/
*.swp
*.swo

# Logs
npm-debug.log*
bun-debug.log*
logs/
*.log

# Local config & secrets
config.json
.env
.env.local
.env.*.local
*.p8
*.p12
*.cer

# Local-only AI workflow artifacts (specs/plans gitignored per project policy)
docs/superpowers/

# Legacy Electron app artifacts
legacy/electron/node_modules/
legacy/electron/dist/
```

- [ ] **Step 2: Verify**

Run: `git status`
Expected: `.gitignore` shows as modified; no `node_modules/` or build outputs accidentally tracked.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for monorepo build outputs and secrets"
```

---

## Section 3: Root documentation

### Task 10: Apache 2.0 LICENSE file

**Files:**
- Create: `LICENSE`

**Steps:**

- [ ] **Step 1: Download the Apache 2.0 license text**

Run: `curl -fsSL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE`
Expected: the canonical Apache 2.0 license text saved to `LICENSE`.

- [ ] **Step 2: Verify**

Run: `head -5 LICENSE`
Expected: starts with `                                 Apache License`

Run: `wc -l LICENSE`
Expected: ~202 lines (the standard Apache 2.0 text).

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "docs: add Apache 2.0 license"
```

---

### Task 11: Root `README.md`

**Files:**
- Modify: `README.md` (replace existing Electron-focused content)

**Steps:**

- [ ] **Step 1: Replace `README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README for Vox Era monorepo"
```

---

### Task 12: Root `CLAUDE.md` (replaces Electron-focused version)

**Files:**
- Modify: `CLAUDE.md`

**Steps:**

- [ ] **Step 1: Replace `CLAUDE.md`**

```markdown
# CLAUDE.md

AI dev workflow guide for Vox Era — a cross-platform speech-to-text desktop app, currently migrating from Electron (legacy) to Tauri.

## What Vox Era is

**Vox Era** is the new Tauri-based version of what was originally **Ada** (a macOS-only Electron app). The migration is in flight on branch `execution` (branched from `tech-stack` at the start of Plan A; final PR `execution` → `main` lives at the end of Plan D). The legacy Electron app lives under `legacy/electron/` for reference and is removed at the end of Plan D.

- **Display name:** Vox Era
- **URL slug:** `vox-era`
- **Identifier (no hyphens):** `voxera` (used for Cargo crate name and macOS bundle id `com.programow.voxera`)
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
- `pulumi-self-hosted-iac` — S3 state backend + KMS secrets, AWS profile, Cloudflare provider
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md for Vox Era monorepo"
```

---

### Task 13: `CONTRIBUTING.md`

**Files:**
- Create: `CONTRIBUTING.md`

**Steps:**

- [ ] **Step 1: Create `CONTRIBUTING.md`**

```markdown
# Contributing to Vox Era

Thanks for your interest. Vox Era is open source under Apache 2.0.

## Branching & PRs

- PRs are the expected workflow so CI runs and the diff is reviewable. `main` is not GitHub-protected (the repo is private and classic protection requires Pro on private repos; we'll enable protection when the repo goes public — one-shot command documented in `docs/ci-cd.md`).
- Open a PR from a feature branch (e.g., `feat/<short-description>`, `fix/<bug-id>`).
- All CI checks should pass before merging — don't merge red even though nothing technically blocks you yet.
- Linear history: prefer rebase merge over merge commits. Keep your branch up to date with `git fetch origin && git rebase origin/main`.

## Commit messages

[Conventional Commits 1.0](https://www.conventionalcommits.org/) is **enforced** via lefthook + commitlint.

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `build`, `ci`, `refactor`, `perf`, `style`, `revert`.

Format: `<type>(<optional scope>): <subject>`

Examples:

- `feat(desktop): add Groq provider adapter`
- `fix(landing): resolve hydration mismatch in changelog page`
- `docs: update permissions doc for new Accessibility flow`
- `ci: add Linux deb signing job`

## Hooks

Lefthook installs hooks automatically on `bun install` (via the `prepare` script). The hooks are:

- **pre-commit:** Biome formats + lints staged TS/JS/JSON files. Fast (<5s).
- **commit-msg:** commitlint blocks non-conventional commit messages.
- **pre-push:** typecheck + lint at root (and tests once packages have them). Target <60s total.

If you need to bypass hooks for a specific reason, ask in the PR — don't `--no-verify` silently.

## Testing discipline

Strict TDD per the writing-plans skill: failing test first, then implementation. Tests are organized in 4 layers (unit / integration / functional / E2E) per `docs/testing.md` (Plan B).

Integration tests mock at the **system boundary**, never inside it (HTTP via MSW v2 + wiremock; OS APIs via trait swaps). See `docs/testing.md`.

## Documentation update obligations

If your PR triggers any of the rows below, the same PR must update the affected docs.

| Trigger | Update these docs |
|---|---|
| New STT provider | `docs/providers.md`, `packages/desktop/README.md`, `packages/landing/src/components/providers-grid.tsx`, the provider's `pricing` field with `lastUpdated` |
| New model added to existing provider | Provider adapter file's `defaultModels` + `pricing` table (with `lastUpdated`) |
| Provider rate change | Provider adapter file's `pricing.lastUpdated` + per-model rate |
| New Tauri command | `docs/architecture.md` (command surface table) |
| New slash command | `docs/development-workflow.md`, root `CLAUDE.md` |
| New target platform | `docs/permissions.md`, `docs/install-<platform>.md`, `docs/build-and-release.md`, `docs/ci-cd.md`, root `README.md` |
| SQLite schema migration | `docs/architecture.md` (history schema section) |
| Signing or release pipeline change | `docs/build-and-release.md`, `docs/ci-cd.md` |
| New audio source / capture mode | `docs/architecture.md` (audio module), `docs/permissions.md` |
| Threat model change | `docs/secrets.md`, `packages/landing/src/app/privacy/page.tsx` |
| New required GitHub Secret | `docs/build-and-release.md`, `docs/ci-cd.md` |

Use `/sync-docs` before opening a PR — it audits your changes against this table and proposes patches.

## License

By contributing you agree your contributions are licensed under Apache 2.0.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md with branching, commits, and doc-update rules"
```

---

### Task 14: `docs/README.md` index

**Files:**
- Create: `docs/README.md` (replacing the existing one if any — the existing one references legacy Electron content)

**Steps:**

- [ ] **Step 1: Replace `docs/README.md`**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/README.md
git commit -m "docs: refresh docs index for Vox Era plan structure"
```

---

## Section 4: GitHub Actions base CI

### Task 15: Base CI workflow (lint + typecheck only)

**Files:**
- Create: `.github/workflows/ci.yml`

**Steps:**

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint (Biome)
        run: bun run lint

      - name: Typecheck
        run: bun run typecheck
```

Note: this base CI runs only `lint-typecheck`. Plans B/C add `test-desktop-mac`, `test-desktop-win`, `test-desktop-linux`, `test-landing`, and `pr-preview-landing` jobs. Plan D adds the tag-triggered `release.yml`.

- [ ] **Step 2: Verify locally that the same commands pass**

Run: `bun run lint && bun run typecheck`
Expected: both succeed (typecheck is a placeholder echo at this stage).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add base CI workflow with lint and typecheck"
```

---

### Task 16: PR template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Steps:**

- [ ] **Step 1: Create `.github/PULL_REQUEST_TEMPLATE.md`**

```markdown
## Summary

<!-- 1-3 bullets describing what changed and why -->

## Test plan

- [ ] Unit tests added/updated and passing
- [ ] Integration tests added/updated and passing (where applicable)
- [ ] Manual smoke test (describe what you exercised)

## Documentation update obligations (per CONTRIBUTING.md trigger table)

Did this PR trigger any of the following? If yes, the relevant docs are updated in this PR.

- [ ] New STT provider → `docs/providers.md`, provider grid in landing, `pricing` entries
- [ ] New model added → provider adapter `defaultModels` + `pricing.lastUpdated`
- [ ] Provider rate change → `pricing.lastUpdated`
- [ ] New Tauri command → `docs/architecture.md`
- [ ] New slash command → `docs/development-workflow.md`, root `CLAUDE.md`
- [ ] New platform → `docs/permissions.md`, `docs/install-<platform>.md`, `docs/build-and-release.md`, `docs/ci-cd.md`
- [ ] SQLite schema migration → `docs/architecture.md`
- [ ] Signing/release pipeline change → `docs/build-and-release.md`, `docs/ci-cd.md`
- [ ] Threat model change → `docs/secrets.md`, `packages/landing/src/app/privacy/page.tsx`
- [ ] New GitHub Secret → `docs/build-and-release.md`, `docs/ci-cd.md`
- [ ] None of the above applies to this PR

## Breaking changes

<!-- Mark with `BREAKING CHANGE:` in the commit body if so. Otherwise: "None". -->
```

- [ ] **Step 2: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add PR template with doc-update checklist"
```

---

## Section 5: AI workflow scaffolding

### Task 17: `/sync-docs` slash command

**Files:**
- Create: `.claude/commands/sync-docs.md`

**Steps:**

- [ ] **Step 1: Create `.claude/commands/sync-docs.md`**

```markdown
---
description: Audit current branch changes against the documentation update trigger table; propose doc patches.
---

You are auditing this branch for documentation update obligations.

**Step 1:** Run `git diff main...HEAD --name-only` to list every file changed on this branch since it diverged from main.

**Step 2:** For each changed file, classify it against the trigger table in `CONTRIBUTING.md`:

- New file matching `packages/desktop/src/providers/*.ts` (excluding `index.ts` and `types.ts`) → New STT provider trigger
- Change to a `defaultModels` array in a provider adapter → New model added trigger
- Change to a `pricing` table entry in a provider adapter → Provider rate change trigger
- New `#[tauri::command]` in `packages/desktop/src-tauri/src/` → New Tauri command trigger
- New file in `.claude/commands/*.md` → New slash command trigger
- Changes to platform-specific code paths (`#[cfg(target_os = "...")]` or `process.platform` checks for a new OS) → New platform trigger
- New SQL migration file or change to `Migration` registration → SQLite schema migration trigger
- Changes to `release.yml` or `tauri.conf.json` `bundle` section → Signing/release pipeline change
- Changes to `secrets/`, `keyring`, or addition of telemetry/analytics code → Threat model change trigger
- New `secrets.<NAME>` reference in workflow YAML → New GitHub Secret trigger

**Step 3:** For each trigger you identified, list the docs that need updating per the table. Then check which of those docs were ALREADY modified on this branch.

**Step 4:** Report your findings as a checklist:

```
## Doc-update audit for branch [branch-name]

Triggers detected:
- Trigger X (file/change A)
  - Required updates: docs/foo.md, docs/bar.md
  - Status: docs/foo.md ✅ updated, docs/bar.md ❌ missing

Proposed patches:
[diffs or descriptions of needed updates]
```

**Step 5:** If you identify missing doc updates, ask the user if they want you to apply them now or defer to a follow-up commit. Do not apply changes without confirmation.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/sync-docs.md
git commit -m "feat(claude): add /sync-docs slash command for doc-update audits"
```

---

## Section 6: End-to-end verification

### Task 18: Toolchain smoke test

**Files:** none (verification only)

**Steps:**

- [ ] **Step 1: Verify clean install from scratch**

Run:
```bash
rm -rf node_modules bun.lockb
bun install
```
Expected: `bun install` completes with no errors; `bun.lockb` recreated; lefthook installs hooks via the `prepare` script.

- [ ] **Step 2: Verify all top-level scripts**

Run: `bun run lint`
Expected: passes.

Run: `bun run typecheck`
Expected: placeholder echoes from desktop and landing print, exit 0.

Run: `bun run test`
Expected: placeholder echoes from desktop and landing print, exit 0.

- [ ] **Step 3: Verify hooks fire on a test commit (do not commit anything new)**

Run:
```bash
echo "test" > /tmp/staged.tmp
echo "feat: hooks dry run" > /tmp/test-msg.txt
bunx lefthook run pre-commit
bunx lefthook run commit-msg --force /tmp/test-msg.txt
bunx lefthook run pre-push
```
Expected: each hook completes successfully.

- [ ] **Step 4: Verify a non-conventional commit message is rejected**

Run:
```bash
echo "banana" > /tmp/bad-msg.txt
bunx lefthook run commit-msg --force /tmp/bad-msg.txt && echo UNEXPECTED-PASS || echo OK-REJECTED
```
Expected: `OK-REJECTED`

No commit for this task; it's pure verification.

---

### Task 19: First conventional commit on the new toolchain

**Files:** none (validates real commit flow)

**Steps:**

- [ ] **Step 1: Make a small no-op edit to a tracked file**

Run: `echo "" >> docs/README.md`

- [ ] **Step 2: Stage and commit using a conventional message; pre-commit + commit-msg fire**

```bash
git add docs/README.md
git commit -m "chore: confirm hook chain on first real commit"
```
Expected: pre-commit runs Biome (no changes since `docs/` is ignored from formatting); commit-msg accepts the message; commit succeeds.

- [ ] **Step 3: Verify the commit landed**

Run: `git log -1 --oneline`
Expected: most recent commit is `chore: confirm hook chain on first real commit`.

---

## Section 7: GitHub repo rename

### Task 20: Rename `programow/ada` → `programow/vox-era` and finalize

**Files:** none (uses `gh` CLI for GitHub operations)

**Pre-flight:** verify `gh` is installed and authenticated.

```bash
gh --version
gh auth status
```
Expected: `gh` version printed; logged in to github.com. If not logged in, run `gh auth login` first.

**Steps:**

- [ ] **Step 1: Push current branch to origin**

```bash
git push -u origin execution
```
Expected: `execution` branch pushed to `origin`.

- [ ] **Step 2: Rename the repo on GitHub via `gh` CLI**

Run:
```bash
gh repo rename vox-era --repo programow/ada
```
Expected: `✓ Renamed repository programow/vox-era`.

GitHub automatically redirects old URLs, preserves stars/watchers/issues/PRs/branches/releases. The `git remote` URL still works via redirect.

- [ ] **Step 3: Update the local git remote URL to the canonical new name**

```bash
git remote set-url origin git@github.com:programow/vox-era.git
git fetch origin
git remote -v
```
Expected: origin URL is `git@github.com:programow/vox-era.git`.

- [ ] **Step 4: Verify CI runs on the pushed branch**

Classic branch protection rules require GitHub Pro or higher on private repos, and the repo is private until launch. Skipping protection setup for now — it can be added in Plan D once the repo goes public (or whenever you upgrade). Two-person honor system in the meantime: open PRs, let CI run, don't merge red.

Visit `https://github.com/programow/vox-era/actions` after pushing `execution` and confirm the `Lint & Typecheck` workflow runs and passes.

- [ ] **Step 5: Open a PR for `execution` and verify CI runs**

Visit `https://github.com/programow/vox-era/compare/main...execution`, open a PR titled "Plan A: monorepo bootstrap".

Expected: `Lint & Typecheck` job runs and passes. PR is mergeable (after approval if you've configured one).

Do NOT merge this PR yet. The `execution` branch carries Plans B, C, and D's work too. Plan A's tasks are merged when the full migration ships (Plan D Task 19), or split into separate PRs at the implementor's discretion.

---

## Plan A complete

At this point:

- [x] Bun monorepo bootstrapped with workspaces
- [x] Three empty package skeletons (`@vox-era/desktop`, `@vox-era/landing`, `@vox-era/infra`) ready for Plans B, C, and D
- [x] Legacy Electron app archived under `legacy/electron/` (removed in Plan D)
- [x] Tooling configured: Biome, Lefthook, commitlint, TypeScript base config
- [x] Conventional commits enforced via `commit-msg` hook
- [x] Pre-commit auto-formats staged files; pre-push runs typecheck + lint
- [x] Apache 2.0 LICENSE in place
- [x] Root docs rewritten: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/README.md`
- [x] Base CI green on `lint-typecheck` (Ubuntu)
- [x] PR template with doc-update checklist
- [x] `/sync-docs` slash command
- [x] GitHub repo renamed `programow/ada` → `programow/vox-era`
- [ ] Branch protection deferred (requires repo to be public or GitHub Pro; user decides when to flip; one-shot `gh api PUT` documented in `docs/ci-cd.md`)

**Hand-off:** Plans B and C can start in parallel. Plan D waits for B and C to ship before its release pipeline can validate end-to-end.
