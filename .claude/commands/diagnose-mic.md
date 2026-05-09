---
description: Read-only diagnostic for Ada's microphone / packaged build. Reports a punch list of ✓ / ✗ checks. Does not modify state.
---

Run the following checks in order. For each, print a single line of
the form `✓ <description>` or `✗ <description> — <fix hint>`. Do not
modify any state. After all checks, print a one-line summary.

## Check 1: Is `/Applications/Ada.app` present?

```bash
test -d /Applications/Ada.app
```

Fix hint if missing: "Run `/build-clean` to build and install."

## Check 2: Are entitlements signed into the bundle?

```bash
codesign -d --entitlements - /Applications/Ada.app 2>&1 | grep -q 'com.apple.security.device.audio-input'
```

Fix hint if missing: "Re-sign with `codesign --force --deep --sign - --entitlements entitlements.plist /Applications/Ada.app` or run `/build-clean`."

Skip this check if Check 1 failed.

## Check 3: Is the bundle's signature valid?

```bash
codesign --verify --verbose /Applications/Ada.app 2>&1
```

Valid output contains `valid on disk` and `satisfies its Designated Requirement`. If anything else, the signature is broken.

Fix hint if invalid: "Run `/build-clean` for a clean rebuild and re-sign."

Skip if Check 1 failed.

## Check 4: Is Ada currently running?

```bash
pgrep -f /Applications/Ada.app >/dev/null
```

Note: this is informational, not a failure mode. If Ada isn't running,
report "Ada is not currently running" — not a ✗.

## Check 5: Does `config.json` exist with a non-placeholder API key?

```bash
test -f config.json && python3 -c "import json,sys; k=json.load(open('config.json')).get('openai_api_key',''); sys.exit(0 if k and k!='sk-...' else 1)"
```

Fix hint if missing/placeholder: "Edit `config.json` and set a real `openai_api_key`. Schema in `docs/whisper-integration.md`."

## Summary

After all checks, print:

- If everything passed: "All checks passed. If mic still doesn't work, the issue is likely TCC: open System Settings → Privacy & Security → Microphone and confirm Ada is enabled. If absent, run `/reset-perms` and relaunch Ada."
- If anything failed: "Failures above. Address them top-to-bottom — missing app blocks the rest."

This command is read-only. Do not run any commands that modify state
(no `tccutil`, no `rm`, no `codesign --force`).
