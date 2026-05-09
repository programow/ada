---
description: Full clean build & install ritual for Vox Era (Tauri). Resets TCC on macOS, rebuilds, copies the bundle.
---

Run the cross-platform clean-build ritual for Vox Era. The full rationale lives in `docs/build-and-release.md` (written in Plan D); this command is the operational entry point.

Vox Era uses Tauri 2 (not Electron). The bundle identifier is `com.programow.voxera`. The packaged app name is `Vox Era`.

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

1. `tccutil reset Microphone com.programow.voxera`
2. `tccutil reset Accessibility com.programow.voxera`
3. `rm -rf "/Applications/Vox Era.app" packages/desktop/src-tauri/target/release/bundle/`
4. `cd packages/desktop && bun run tauri:build`
5. `cp -R "packages/desktop/src-tauri/target/release/bundle/macos/Vox Era.app" "/Applications/Vox Era.app"`

Ask: "This will delete `/Applications/Vox Era.app` and the Tauri release bundle output. Proceed?" Wait for confirmation.

### Run the ritual

Halt on the first non-zero exit and report which step failed.

```bash
# 1-2: Reset TCC. tccutil exits non-zero when no entry exists; treat that as success.
tccutil reset Microphone com.programow.voxera || true
tccutil reset Accessibility com.programow.voxera || true

# 3: Remove the previous install + bundle output.
rm -rf "/Applications/Vox Era.app" packages/desktop/src-tauri/target/release/bundle/

# 4: Build (signed via the configured signing identity if set; otherwise ad-hoc).
cd packages/desktop && bun run tauri:build

# 5: Install.
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

Launch Vox Era. macOS will prompt for Microphone, then later (when the global shortcut fires for the first time) for Accessibility. Approve both. If no prompts appear, run `/reset-perms` and relaunch — a previous denial may be cached.

For symptom-keyed troubleshooting, see `docs/troubleshooting.md` (Plan D).
