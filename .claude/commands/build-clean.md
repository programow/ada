---
description: Full clean build & install ritual for Vox Era (Tauri). Resets TCC on macOS, rebuilds, copies the bundle.
---

Run the cross-platform clean-build ritual for Vox Era. The full rationale lives in `docs/build-and-release.md` (written in Plan D); this command is the operational entry point.

Vox Era uses Tauri 2 (not Electron). The bundle identifier is `com.vhtechnology.voxera`. The packaged app name is `Vox Era`.

## Preflight

Confirm the working directory is the Vox Era repo root:

```bash
test -f packages/desktop/src-tauri/tauri.conf.json && \
  test -f packages/desktop/package.json
```

If either check fails, abort with: "Not in the Vox Era repo root. Refusing to run destructive build steps."

Detect the host OS via `uname -s` and dispatch.

## macOS

### Confirm with the user

Print the steps that are about to run and ask for confirmation before any destructive op:

1. `tccutil reset Microphone com.vhtechnology.voxera`
2. `tccutil reset Accessibility com.vhtechnology.voxera`
3. `tccutil reset ListenEvent com.vhtechnology.voxera`
4. `tccutil reset AppleEvents com.vhtechnology.voxera`
5. `rm -rf "/Applications/Vox Era.app" packages/desktop/src-tauri/target/release/bundle/`
6. `cd packages/desktop && bun run tauri:build`
7. `cp -R "packages/desktop/src-tauri/target/release/bundle/macos/Vox Era.app" "/Applications/Vox Era.app"`

Ask: "This will delete `/Applications/Vox Era.app` and the Tauri release bundle output. Proceed?" Wait for confirmation.

### Run the ritual

Halt on the first non-zero exit and report which step failed.

```bash
# 1-4: Reset TCC. tccutil exits non-zero when no entry exists; treat that as success.
tccutil reset Microphone com.vhtechnology.voxera || true
tccutil reset Accessibility com.vhtechnology.voxera || true
tccutil reset ListenEvent com.vhtechnology.voxera || true
tccutil reset AppleEvents com.vhtechnology.voxera || true

# 5: Remove the previous install + bundle output.
rm -rf "/Applications/Vox Era.app" packages/desktop/src-tauri/target/release/bundle/

# 6: Build (signed via the configured signing identity if set; otherwise ad-hoc).
cd packages/desktop && bun run tauri:build

# 7: Install.
cp -R "src-tauri/target/release/bundle/macos/Vox Era.app" "/Applications/Vox Era.app"
```

### Verify

Unlike the Electron-era Ada, **Tauri does not require a manual `--deep` re-sign step**. Tauri's bundler propagates entitlements correctly into nested binaries during `tauri build`. To confirm the entitlement landed:

```bash
codesign -d --entitlements - "/Applications/Vox Era.app" 2>&1 | grep 'com.apple.security.device.audio-input'
```

If the grep finds nothing, `entitlements.plist` was not picked up — check `tauri.conf.json` `bundle.macOS.entitlements`.

## Linux

### Confirm with the user

1. `rm -rf packages/desktop/src-tauri/target/release/bundle/`
2. `cd packages/desktop && bun run tauri:build`
3. `sudo dpkg -i src-tauri/target/release/bundle/deb/Vox*.deb` (or `sudo rpm -i ...rpm` on Fedora)

Wait for confirmation before running step 3 (sudo).

Deb runtime dependencies are declared in `tauri.conf.json` under `bundle.linux.deb.depends`: `libwebkit2gtk-4.1-0`, `libayatana-appindicator3-1`.

## Windows

```powershell
cd packages\desktop
bun run tauri:build
Start-Process "src-tauri\target\release\bundle\msi\Vox Era_*_x64_en-US.msi"
```

## After install

Launch Vox Era. macOS will prompt for Microphone, then later (when the global shortcut fires for the first time) for Accessibility — plus Input Monitoring the first time the user picks the Fn key as their shortcut. Approve them as they appear. If no prompts appear, run `/reset-perms` and relaunch — a previous denial may be cached.

For symptom-keyed troubleshooting, see `docs/troubleshooting.md` (Plan D).
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
