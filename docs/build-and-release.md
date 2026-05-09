# Build & Release

> **Most of the time, run `/build-clean` instead of doing this by hand.**
> The slash command (`.claude/commands/build-clean.md`) automates every
> step below. This document exists to explain *why* each step matters
> so you can debug when the slash command fails.

Producing a working `/Applications/Ada.app` from source is a five-step
ritual. Skipping any step (especially the re-sign) produces a build
that looks installed but silently fails to record audio or paste text.

## Step 1: Reset macOS permissions

```bash
tccutil reset Microphone com.programow.ada
tccutil reset Accessibility com.programow.ada
```

**Why:** macOS TCC (Transparency, Consent, and Control) caches
permission decisions against the tuple `(bundle-id, code-signing-identity)`.
A re-signed build looks like a different app to TCC even though the
bundle id is unchanged. Resetting forces TCC to re-prompt on next
launch. Without this, a denial granted to a previous build silently
carries over and the user never sees a prompt.

## Step 2: Remove the previous install and build artifacts

```bash
rm -rf /Applications/Ada.app dist/
```

**Why:** Copying a freshly-signed bundle on top of an existing
differently-signed bundle produces signature-validation errors that
are hard to diagnose. A clean copy is reliable. `dist/` is wiped so
the build doesn't pick up stale outputs.

## Step 3: Build the bundle

```bash
npm run build
```

**What it produces:** electron-builder writes `dist/mac-arm64/Ada.app`
and a corresponding `dist/Ada-<version>-arm64.dmg`. The `.app` is what
you install; the `.dmg` is what you'd ship to a user.

## Step 4: Install

```bash
cp -R dist/mac-arm64/Ada.app /Applications/Ada.app
```

A plain recursive copy is sufficient. macOS does not need any further
registration step for `.app` bundles.

## Step 5: Re-sign with entitlements (the critical step)

```bash
codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app
```

**Why:** electron-builder ad-hoc signs (`--sign -`) the outer bundle,
but its current behavior does not reliably propagate the entitlements
file to *nested* binaries inside the bundle (Helper.app, frameworks).
The microphone capability
(`com.apple.security.device.audio-input`) needs to be present on the
binaries that actually call into CoreAudio, not just the outer
launcher. `--deep` walks the bundle and re-signs every nested binary
with the same entitlements file; `--force` overrides the existing
electron-builder signature.

Without this step: the app launches, but `getUserMedia` returns no
audio and the renderer console shows a permission error — even after
you "granted" microphone access, because the inner binary that
actually requested it was never entitled to ask.

## Verifying the install

Confirm entitlements actually stuck on the installed bundle:

```bash
codesign -d --entitlements - /Applications/Ada.app
```

Look for `<key>com.apple.security.device.audio-input</key>` followed
by `<true/>` in the output. If it's missing, step 5 didn't run
or didn't apply. Re-run it.

Confirm the signature itself is valid:

```bash
codesign --verify --verbose /Applications/Ada.app
```

Expected: `valid on disk` and `satisfies its Designated Requirement`.

## After install

Launch Ada from `/Applications/Ada.app`. macOS should prompt for
Microphone, then later for Accessibility (the latter is needed so the
synthetic `Cmd+V` keystroke can reach other apps). Approve both. If
no prompts appear, run [`/reset-perms`](../.claude/commands/reset-perms.md)
and relaunch — a previous denial may be cached.

For permission troubleshooting, see [Permissions](permissions.md).
For general failures, see [Troubleshooting](troubleshooting.md).
