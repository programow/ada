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
