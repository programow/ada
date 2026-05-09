---
description: Reset macOS Microphone and Accessibility permissions for Vox Era (com.vhtechnology.voxera). Use when permission prompts no longer appear or to retest the grant flow.
---

Reset the macOS TCC entries for Vox Era so that Microphone and Accessibility prompts fire again on next launch.

No-op on Linux and Windows: those platforms either don't gate microphone access at all (Linux desktop) or surface a single OS-level prompt at first use (Windows). If invoked on a non-macOS host, print `"Skipping — TCC reset is macOS-only."` and exit.

On macOS, run these two commands sequentially:

```bash
tccutil reset Microphone com.vhtechnology.voxera
tccutil reset Accessibility com.vhtechnology.voxera
```

`tccutil` occasionally exits non-zero when the system has never seen a TCC entry for the bundle id — that is harmless; mention it if you see it but do not abort.

After both succeed, tell the user:

> Permissions reset. Relaunch Vox Era from `/Applications/Vox Era.app` so macOS re-prompts for Microphone, then later for Accessibility (the latter only fires when the global shortcut is pressed for the first time). If no prompts appear, the bundle is missing entitlements — run `/diagnose`.

Do not run any other commands. This command is intentionally minimal.
