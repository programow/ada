# Development Workflow

Ada ships with four project-local Claude Code slash commands under
[`.claude/commands/`](../.claude/commands/). They automate the
rituals that this project would otherwise require you to remember
and run by hand.

## When to use which command

| You're doing… | Run | Why |
|---|---|---|
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
