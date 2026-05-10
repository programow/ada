# Troubleshooting

> **This doc is being rewritten in Plan D.** The previous version was symptom-keyed
> for the Electron-era Ada app (Whisper-only, `paste-helper.swift`,
> `com.programow.ada` TCC bundle). That content no longer applies — Vox Era is
> Tauri 2 with bundle id `com.vhtechnology.voxera`, 9 STT providers, cpal-based
> capture, and `enigo`-based paste.
>
> Until Plan D lands the Tauri-era punch list, the closest equivalents are:
>
> - **macOS permission issues** (Mic / Accessibility prompts not showing,
>   stale denials): [`permissions.md`](./permissions.md) and `/reset-perms`
>   slash command
> - **Provider HTTP failures** (401, 429, network): see the relevant provider's
>   docs URL inside `packages/desktop/src/providers/<provider>.ts`
> - **Packaged-build smoke test:** `/diagnose` slash command
> - **Hotkey doesn't fire** (macOS Fn-key with Accessibility denied,
>   Ctrl+Shift+Space conflict on other platforms): see Plan D's troubleshooting
>   rewrite once landed; in the meantime check Accessibility grant on macOS via
>   System Settings → Privacy & Security
>
> A full symptom-keyed rewrite for the Tauri-era app lands as part of Plan D
> (Section 13 of the release-pipeline plan).
