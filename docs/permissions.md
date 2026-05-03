# Permissions

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
tccutil reset Microphone com.programow.ada
tccutil reset Accessibility com.programow.ada
```

Or run [`/reset-perms`](../.claude/commands/reset-perms.md). Then
relaunch Ada.
