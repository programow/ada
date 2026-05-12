# Permissions

Vox Era needs two privacy grants on platforms that gate them:

- **Microphone** — to record audio. Required everywhere.
- **Accessibility / Input Monitoring** — to inject the synthetic `Cmd+V` / `Ctrl+V` keystroke and (on macOS) to listen to the Fn key via `CGEventTap`. Required on macOS; not gated on Linux or Windows.

The per-platform implementations live under `packages/desktop/src-tauri/src/audio/permissions/`. The webview never speaks to the OS directly — it calls the Tauri commands `check_microphone_permission`, `request_microphone_permission`, `check_accessibility_permission`, `request_accessibility_permission`, and `open_settings_panel` (all defined in `commands.rs`).

## macOS

### Microphone

**Granted via:** TCC, prompted on first call to `AVCaptureDevice.requestAccess(forMediaType:)`.

**Required pieces:**

1. **Entitlement** — `com.apple.security.device.audio-input` must be signed into every binary in the bundle that calls into CoreAudio. Source: `packages/desktop/src-tauri/entitlements.plist`. Wired to the bundle via `tauri.conf.json` `bundle.macOS.entitlements`. Tauri's bundler propagates the entitlement to nested binaries during `tauri build` — unlike Electron, no manual `--deep` re-sign step is needed.
2. **Usage description** — `NSMicrophoneUsageDescription` in `Info.plist`. Configured in `packages/desktop/src-tauri/Info.plist` and referenced from `tauri.conf.json` `bundle.macOS.infoPlist`. Without this string, macOS rejects the permission request without showing a prompt.
3. **Runtime trigger** — the React webview calls `vox.requestMicrophonePermission()`, which dispatches to `audio::permissions::macos::request_microphone_permission`. That function calls `AVCaptureDevice.requestAccess` via `objc2-av-foundation`. The closure is bridged through `block2`.

**To check status:**

- System Settings → Privacy & Security → Microphone → look for `Vox Era`.
- From the app: the Settings tab surfaces the current `PermissionState` from `vox.checkMicrophonePermission()`.
- Diagnostic slash command: `/diagnose` (read-only).

### Accessibility (Fn-key shortcut + paste)

**Granted via:** TCC, prompted on first attempt to (a) post a synthetic keyboard event via `CGEventPost`, or (b) install the `CGEventTap` for the Fn key.

**Required pieces:**

1. **Runtime trigger** — `audio::permissions::macos::request_accessibility_permission` calls `AXIsProcessTrustedWithOptions` with the `kAXTrustedCheckOptionPrompt` option set. macOS opens System Settings → Privacy & Security → Accessibility; the user must flip the toggle.
2. **Approval scope** — the toggle is per-bundle-id. The bundle id is `com.vhtechnology.voxera` (set in `tauri.conf.json` `identifier`).

**Why this is needed:**

- The paste step uses `enigo::Enigo::key_down(Key::Meta) → key_click(Key::V) → key_up(Key::Meta)` which lowers to `CGEventPost`. macOS treats event injection as input monitoring, gated by Accessibility.
- The macOS Fn-key shortcut backend (`shortcut/macos_fn.rs`) installs a `CGEventTap` filtered to `flagsChanged`. Event taps require Accessibility too. If the user picks `HotkeyCombo::Fn`, the manager's `register()` must succeed, which surfaces `ShortcutError::AccessibilityRequired` if the grant is missing.

## Windows

### Microphone

Windows 10/11 gates microphone access via the privacy settings UI (`Settings → Privacy → Microphone`). Behavior:

- The first WASAPI capture call (made by `cpal`) succeeds silently or fails depending on the global "Allow apps to access your microphone" toggle and the per-app toggle.
- `audio::permissions::windows::check_microphone_permission` reads the registry under `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone` to surface a coarse `Granted` / `Denied` / `NotDetermined`.
- `request_microphone_permission` opens the Privacy panel via `ms-settings:privacy-microphone` (handled by `open_settings_microphone_panel`); there is no Win32 prompt API.

### Accessibility

Not gated. `check_accessibility_permission` always returns `Granted`. Windows allows synthetic key injection via `SendInput` without a per-app grant.

## Linux

### Microphone

Linux desktops do not gate microphone access at the OS level. PulseAudio / PipeWire grants by default; capture starts working as soon as `cpal` opens a device.

For Flatpak / sandboxed builds, the `device=all` permission must be set; that's a Plan D concern.

`check_microphone_permission` returns `Granted` unconditionally on Linux today.

### Accessibility

Not gated. Synthetic keystrokes via `enigo` (XTest under X11, libei or virtual-input under Wayland) work without a per-app grant on most distros.

## Dev mode vs packaged build

`bun run tauri:dev` runs the Tauri app from your terminal in debug mode. On macOS, both Microphone and Accessibility permissions are inherited from the parent process — specifically, from your terminal application (Terminal.app, iTerm, Ghostty, etc.). If the terminal already has those grants, dev-mode Vox Era just works without prompting. **This means a dev build is not a fair test of the packaged permission flow.**

A packaged build (built with `tauri build` and installed to `/Applications/Vox Era.app`) has its own bundle id (`com.vhtechnology.voxera`) and asks TCC for its own grants. Always test permission-related changes against the packaged build via `/build-clean`.

Windows and Linux do not have this dev-mode shortcut; the privacy-settings panels see the binary path, not the parent process.

## Resetting (macOS)
Ada needs two macOS privacy grants to function: **Microphone** (to
record audio) and **Accessibility** (to inject the synthetic `Cmd+V`
keystroke into the focused application). Both are gated by macOS TCC
and both behave differently in dev mode versus a packaged build.

## Microphone

**Granted via:** TCC, prompted on first `getUserMedia` call.

**Required pieces:**

1. **Entitlement** — `com.apple.security.device.audio-input` must be
   signed into every binary in the bundle that calls into CoreAudio.
   Source: [`entitlements.plist`](../entitlements.plist). Applied during
   the re-sign step in the build ritual; see
   [build-and-release.md](build-and-release.md).
2. **Usage description** — `NSMicrophoneUsageDescription` in
   `Info.plist`. Set via `build.mac.extendInfo` in `package.json`.
   Without it, macOS rejects the permission request without a prompt.
3. **Runtime trigger** — `main.js` calls
   `systemPreferences.askForMediaAccess('microphone')` on app start.
   This is what produces the prompt the user sees.

**To check status:**

- System Settings → Privacy & Security → Microphone → look for `Ada`.
- Or via the diagnostic slash command: `/diagnose-mic` (read-only).

## Accessibility

**Granted via:** TCC, prompted on first attempt to post a synthetic
keyboard event.

**Required pieces:**

1. **Runtime trigger** — `main.js` calls
   `systemPreferences.isTrustedAccessibilityClient(true)` on app start.
   The `true` argument tells macOS to prompt the user if the app
   isn't already trusted.
2. **Approval scope** — the user must toggle Ada on under System
   Settings → Privacy & Security → Accessibility. Unlike Microphone,
   the prompt only opens System Settings; the user has to flip the
   toggle themselves and (depending on macOS version) authenticate.

**Why Accessibility is needed:** the paste step uses
`CGEventPost(.cghidEventTap, ...)` to inject `Cmd+V` into whichever
app has focus. macOS treats event injection as input monitoring,
which is gated by Accessibility, not Microphone.

## Dev mode vs packaged build

`npm start` runs Electron from your terminal. Both Microphone and
Accessibility permissions are inherited from the parent process —
specifically, from your terminal application (Terminal.app, iTerm,
Ghostty, etc.). If the terminal already has those grants, dev-mode
Ada just works without prompting. This is convenient but it means a
dev build is **not** a fair test of the packaged permission flow.

A packaged build (`/Applications/Ada.app`) has its own bundle id
(`com.programow.ada`) and asks TCC for its own grants. Always test
permission-related changes against the packaged build.

## Resetting

If prompts no longer appear, TCC has cached a decision. Reset with:

```bash
tccutil reset Microphone com.vhtechnology.voxera
tccutil reset Accessibility com.vhtechnology.voxera
```

Or run `/reset-perms`. Then relaunch Vox Era.

## Spec cross-references

- §6.3 — Per-platform microphone permission flow
- §6.10 — Accessibility for paste keystroke and macOS Fn-key tap
tccutil reset Microphone com.programow.ada
tccutil reset Accessibility com.programow.ada
```

Or run [`/reset-perms`](../.claude/commands/reset-perms.md). Then
relaunch Ada.
