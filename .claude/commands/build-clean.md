---
description: Run the full clean build & install ritual for Ada. Resets TCC, rebuilds, re-signs with entitlements. Destructive — confirms before deleting.
---

Run Ada's five-step clean build & install ritual end-to-end. The full
rationale for each step is in `docs/build-and-release.md`. Do not
skip any step — in particular, step 5 (re-sign with entitlements) is
the entire reason this command exists.

## Preflight

Before running anything, confirm the working directory is the Ada
repo root:

```bash
test -f main.js && test -f entitlements.plist && test -f package.json
```

If any check fails, abort with: "Not in the Ada repo root. Refusing to run destructive build steps."

## Confirm with the user

Print these five steps that are about to run:

1. `tccutil reset` Microphone + Accessibility for `com.programow.ada`
2. `rm -rf /Applications/Ada.app dist/`
3. `npm run build`
4. `cp -R dist/mac-arm64/Ada.app /Applications/Ada.app`
5. `codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app`

Then ask: "This will delete `/Applications/Ada.app` and `dist/`. Proceed?"
Wait for explicit confirmation. If the user declines, stop.

## Run the ritual

Run the steps sequentially. Halt on the first non-zero exit and report which step failed:

### Step 1: Reset TCC

```bash
tccutil reset Microphone com.programow.ada
tccutil reset Accessibility com.programow.ada
```

`tccutil reset` may exit non-zero if the bundle id has no existing TCC
entry; treat that specific case as success and continue.

### Step 2: Remove the previous install and dist

```bash
rm -rf /Applications/Ada.app dist/
```

### Step 3: Build

```bash
npm run build
```

This runs electron-builder and produces `dist/mac-arm64/Ada.app`.
Report progress; the build can take 30–60 seconds.

### Step 4: Install

```bash
cp -R dist/mac-arm64/Ada.app /Applications/Ada.app
```

### Step 5: Re-sign with entitlements (critical)

```bash
codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app
```

Do not skip this step. Do not omit `--deep`. Do not omit `--entitlements entitlements.plist`.

## Verify

After step 5, confirm entitlements stuck:

```bash
codesign -d --entitlements - /Applications/Ada.app 2>&1 | grep 'com.apple.security.device.audio-input'
```

Expected: a line containing the entitlement key. If the grep finds
nothing, step 5 didn't apply — report the failure to the user.

## Done

If everything succeeded, tell the user:

> Build clean. Launch Ada from `/Applications/Ada.app`. macOS will
> prompt for Microphone access; later, when you press the shortcut,
> for Accessibility. Approve both. If no prompts appear, run
> `/diagnose-mic`.
