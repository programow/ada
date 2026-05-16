---
description: Produce a signed + notarized + stapled bluemacaw release DMG (macOS). Distinct from /build-clean — this is the distribution path, not a dev install.
---

Run the macOS release ritual: build the universal binary, send the DMG through Apple's notary service, staple the ticket, and verify Gatekeeper accepts the result.

`/build-clean` is for dev-local installs (resets TCC and copies into `/Applications`). `/build-release` is for producing a DMG you'd hand to a user.

## Preflight

Confirm the working directory is the bluemacaw repo root:

```bash
test -f packages/desktop/src-tauri/tauri.conf.json && \
  test -f packages/desktop/package.json
```

If either check fails, abort with: "Not in the bluemacaw repo root. Refusing to run release build."

This command only supports macOS hosts. If `uname -s` is not `Darwin`, abort with: "Release build is macOS-only. Use the CI release workflow for cross-platform bundles."

## Verify credentials

The release ritual needs the Developer ID identity in the login keychain and a path to the App Store Connect API key file.

```bash
# 1. Codesign identity present and valid
security find-identity -v -p codesigning | grep -q "Developer ID Application: Programow LTDA"
```

If this fails, abort with: "Codesign identity 'Developer ID Application: Programow LTDA' not found in login keychain. See docs/build-and-release.md."

```bash
# 2. API key file present
: "${APPLE_API_KEY_PATH:=$HOME/apps/creds/blue-macaw/AuthKey_5MY9U2597A.p8}"
test -f "$APPLE_API_KEY_PATH"
```

If missing, abort with: "API key file not found at $APPLE_API_KEY_PATH. Override with APPLE_API_KEY_PATH or place the .p8 there."

## Run the ritual

Export the env vars the script needs, then build + notarize + staple:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Programow LTDA (MK845FM6D2)"
export APPLE_API_ISSUER="ec8c4766-5ca4-4ca6-800e-9566914f4fc6"
export APPLE_API_KEY="5MY9U2597A"
export APPLE_API_KEY_PATH="${APPLE_API_KEY_PATH:-$HOME/apps/creds/blue-macaw/AuthKey_5MY9U2597A.p8}"

cd packages/desktop

# Build the universal binary. Tauri will sign + notarize + staple the .app.
bun run tauri build --target universal-apple-darwin

# Notarize + staple the DMG itself (Tauri doesn't).
./scripts/notarize-staple-dmg.sh
```

Halt on the first non-zero exit and report which step failed.

## After build

Print the path of the resulting DMG:

```bash
ls -lh src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
```

The DMG is now Gatekeeper-ready on any Mac, online or offline. A user can download it, double-click, and drag-to-Applications without seeing any warning.

## Troubleshooting

- **`unable to sign... errSecInternalComponent`** — login keychain locked. Run `security unlock-keychain ~/Library/Keychains/login.keychain-db` and retry.
- **`status: Invalid` during notarization** — the script will print Apple's per-issue log. Common causes: entitlements regressed, an unsigned helper binary leaked into the bundle, or a dependency added an unsigned dylib.
- **Notarization stuck >30 min** — Apple's queue is backed up. Check https://developer.apple.com/system-status/ for "Notary Service" status. The script polls until Apple responds or `notarytool`'s own ~2 hr timeout.
