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
Keyed by symptom. Each entry tells you how to confirm the cause, then
how to fix it.

## Shortcut does nothing when pressed

**Possible causes:**

- **Another app holds `Control+Shift+Space`.** Try the shortcut with
  Ada quit; if something else still happens, that app owns the chord.
  Quit the conflicting app or change Ada's shortcut in `main.js`.
- **Accessibility not granted.** Even though the shortcut is
  *registered* by Electron's `globalShortcut`, the system can
  drop key events for unprivileged processes. Confirm via System
  Settings → Privacy & Security → Accessibility. If Ada is missing
  or off, toggle it on and relaunch.
- **Ada isn't running.** Check `pgrep -f Ada.app` or look at the menu
  bar for the tray icon.

## Recording starts (UI flips to red mic) but transcription is empty

**Possible causes:**

- **Mic muted at the OS level.** System Settings → Sound → Input —
  confirm input level moves when you speak.
- **Wrong default input device.** macOS may have switched to a
  Bluetooth input that isn't actually receiving audio.
- **Entitlements not signed into the packaged bundle.** Run
  `/diagnose-mic` or `codesign -d --entitlements - /Applications/Ada.app`
  and look for `com.apple.security.device.audio-input`. If missing,
  re-run `/build-clean`.

## UI says "Pasted!" but nothing pastes into the focused app

**Cause:** Accessibility permission absent or revoked. The text *is*
on the clipboard — you can `Cmd+V` manually and it works. What's
broken is Ada's ability to inject the keystroke.

**Fix:** System Settings → Privacy & Security → Accessibility → toggle
Ada on. If Ada isn't listed, relaunch it once — the runtime call to
`isTrustedAccessibilityClient(true)` will register it.

## App crashes immediately on launch

**Cause:** `config.json` is missing or malformed. `main.js` loads it
synchronously at startup with `JSON.parse` and no try/catch.

**Fix:** Verify the file exists and parses:

```bash
cat config.json | python3 -m json.tool
```

It must contain `openai_api_key` and `model`. See
[whisper-integration.md](whisper-integration.md) for the schema.

## Re-installed build asks for no permission prompts

**Cause:** macOS TCC has cached a previous decision (likely a denial)
for `com.programow.ada`. Even fresh re-installs inherit it.

**Fix:** Run [`/reset-perms`](../.claude/commands/reset-perms.md) (or
the `tccutil reset` commands by hand), then relaunch Ada.

## Whisper returns 401 Unauthorized

**Cause:** API key in `config.json` is wrong, expired, or revoked.

**Fix:** Generate a new key at
[platform.openai.com](https://platform.openai.com/api-keys), update
`config.json`, and run `/dev` to restart.

## Whisper returns 429 Rate Limited

**Cause:** Account-level rate limit hit. Most common with free-tier
or low-tier OpenAI accounts speaking continuously.

**Fix:** Wait, or upgrade the OpenAI account tier.
