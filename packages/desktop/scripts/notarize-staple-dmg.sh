#!/usr/bin/env bash
# Notarize and staple the DMG(s) produced by `tauri build`.
#
# Tauri's bundler notarizes the .app inside the DMG but never submits the DMG
# itself to Apple. Without that, Gatekeeper accepts the .app once mounted, but
# the DMG mount itself shows "verifying" or (offline) "developer cannot be
# verified". This script closes that gap.
#
# Required env:
#   APPLE_API_ISSUER     App Store Connect API issuer ID (UUID)
#   APPLE_API_KEY        App Store Connect API key ID
#   APPLE_API_KEY_PATH   Absolute path to the AuthKey_<KEYID>.p8 file
#
# Run from packages/desktop/ — it globs the standard tauri bundle output.
# Idempotent: re-running on an already-stapled DMG is a no-op.

set -euo pipefail

missing=()
[[ -n "${APPLE_API_ISSUER:-}" ]] || missing+=("APPLE_API_ISSUER")
[[ -n "${APPLE_API_KEY:-}" ]] || missing+=("APPLE_API_KEY")
[[ -n "${APPLE_API_KEY_PATH:-}" ]] || missing+=("APPLE_API_KEY_PATH")
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "error: missing required env var(s): ${missing[*]}" >&2
  exit 1
fi

if [[ ! -f "$APPLE_API_KEY_PATH" ]]; then
  echo "error: APPLE_API_KEY_PATH does not exist: $APPLE_API_KEY_PATH" >&2
  exit 1
fi

bundle_root="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
if [[ ! -d "$bundle_root" ]]; then
  echo "error: no DMG bundle directory at $bundle_root — did 'tauri build --target universal-apple-darwin' run?" >&2
  exit 1
fi

shopt -s nullglob
dmgs=("$bundle_root"/*.dmg)
shopt -u nullglob
if [[ ${#dmgs[@]} -eq 0 ]]; then
  echo "error: no .dmg files found in $bundle_root" >&2
  exit 1
fi

for dmg in "${dmgs[@]}"; do
  echo ""
  echo "=== Processing $dmg ==="

  echo "--- Submitting to Apple notary service (this can take 5–30 min) ---"
  submit_log=$(mktemp)
  if ! xcrun notarytool submit "$dmg" \
      --key "$APPLE_API_KEY_PATH" \
      --key-id "$APPLE_API_KEY" \
      --issuer "$APPLE_API_ISSUER" \
      --wait 2>&1 | tee "$submit_log"; then
    echo "error: notarytool submit failed for $dmg" >&2
    exit 1
  fi

  # On rejection, surface the per-issue log so CI output explains why.
  if grep -q "status: Invalid" "$submit_log"; then
    sub_id=$(grep -m1 '^  id:' "$submit_log" | awk '{print $2}')
    echo "--- Notarization rejected; fetching log for $sub_id ---" >&2
    xcrun notarytool log "$sub_id" \
      --key "$APPLE_API_KEY_PATH" \
      --key-id "$APPLE_API_KEY" \
      --issuer "$APPLE_API_ISSUER" >&2 || true
    rm -f "$submit_log"
    exit 1
  fi
  rm -f "$submit_log"

  echo "--- Stapling ticket to DMG ---"
  xcrun stapler staple "$dmg"

  echo "--- Validating staple ---"
  xcrun stapler validate "$dmg"

  echo "--- Gatekeeper acceptance check ---"
  spctl -a -t open --context context:primary-signature -vv "$dmg"

  echo "=== OK: $dmg ==="
done

echo ""
echo "All DMGs notarized and stapled:"
for dmg in "${dmgs[@]}"; do echo "  $dmg"; done
