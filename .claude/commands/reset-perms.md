---
description: Reset macOS Microphone and Accessibility permissions for Ada (com.programow.ada). Use when permission prompts no longer appear or to retest the grant flow.
---

Reset the macOS TCC entries for Ada so that Microphone and Accessibility
prompts will fire again on next launch.

Run these two commands sequentially:

```bash
tccutil reset Microphone com.programow.ada
tccutil reset Accessibility com.programow.ada
```

If either command exits non-zero, report the error and stop. `tccutil`
occasionally fails when the system has never seen a TCC entry for the
bundle id, which is harmless — mention this if you see it.

After both succeed, tell the user:

> Permissions reset. Relaunch Ada from `/Applications/Ada.app` so macOS re-prompts for Microphone, then later for Accessibility. If no prompts appear, the bundle is missing entitlements — run `/diagnose-mic`.

Do not run any other commands. This command is intentionally minimal.
