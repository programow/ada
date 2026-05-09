---
name: tauri-release-and-distribution
description: Use when configuring Tauri's release pipeline — Apple Developer ID signing, notarytool, minisign for the auto-updater, GPG-signed Linux deb/rpm packages, or self-hosted apt/dnf repository metadata
---

# Tauri release & distribution

Tauri's release path crosses 5 ecosystems (Apple, Microsoft, Debian, RPM, custom updater). Each step's gotchas in one place.

## macOS: signing → notarization → stapling

The chain:

1. **Codesign** with Developer ID Application cert. Set `APPLE_SIGNING_IDENTITY` env or `bundle.macOS.signingIdentity` in `tauri.conf.json`. Tauri runs `codesign` automatically during `tauri build`.
2. **Notarize** via App Store Connect API. Requires `.p8` API key. Tauri's bundle invokes `xcrun notarytool` if `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH` are all set.
3. **Staple** the ticket so Gatekeeper accepts the DMG offline. **Tauri does NOT always staple automatically** — explicit step:

```bash
xcrun stapler staple path/to/Foo.dmg
```

In CI, base64-decode the .p8 to a temp file:

```yaml
- name: Set up notarization API key
  env:
    KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
    KEY_CONTENT: ${{ secrets.APPLE_API_KEY_CONTENT }}
  run: |
    mkdir -p ~/private_keys
    echo "$KEY_CONTENT" | base64 --decode > ~/private_keys/AuthKey_$KEY_ID.p8
    echo "APPLE_API_KEY_PATH=$HOME/private_keys/AuthKey_$KEY_ID.p8" >> $GITHUB_ENV
```

## Tauri auto-update manifest

Generated as `latest.json`, signed with minisign. Schema:

```json
{
  "version": "1.2.3",
  "notes": "Release notes",
  "pub_date": "2026-05-15T10:00:00Z",
  "platforms": {
    "darwin-x86_64":  { "signature": "<minisig>", "url": "https://..." },
    "darwin-aarch64": { "signature": "<minisig>", "url": "https://..." },
    "windows-x86_64": { "signature": "<minisig>", "url": "https://..." },
    "linux-x86_64":   { "signature": "<minisig>", "url": "https://..." }
  }
}
```

Platform keys are `<os>-<arch>` exactly (`darwin`, `windows`, `linux` × `x86_64`, `aarch64`, `i686`, `armv7`). Tauri produces individual `.sig` files alongside each artifact during `tauri build`; assemble them into `latest.json`.

Public key embedded in `tauri.conf.json` `plugins.updater.pubkey`. Private key + passphrase in `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars during build.

Generate keypair: `bunx @tauri-apps/cli signer generate -w ~/.tauri/key`

## Linux: GPG-sign deb + rpm

```bash
# deb
dpkg-sig --gpg-options "--pinentry-mode loopback --passphrase $GPG_PASSPHRASE" --sign builder dist/foo.deb

# rpm
echo "%_gpg_name $GPG_KEY_ID" >> ~/.rpmmacros
rpmsign --addsign dist/foo.rpm
```

GPG private key imported via `echo "$GPG_PRIVATE_KEY" | gpg --batch --import` with `pinentry-mode loopback` configured (CI has no TTY for passphrase prompt).

## Self-hosted apt + dnf repos

**Apt** (using `aptly`):

```bash
aptly repo create -distribution=stable -component=main project
aptly repo add project *.deb
aptly publish repo -gpg-key="$GPG_KEY_ID" -passphrase="$GPG_PASSPHRASE" -batch project
# Output goes to ~/.aptly/public; sync that to S3.
```

**Dnf** (using `createrepo_c`):

```bash
createrepo_c dnf-dir/
gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" \
    --detach-sign --armor dnf-dir/repodata/repomd.xml
```

Sign `repomd.xml`, NOT individual rpms (those are signed separately by `rpmsign`).

## End-user install

```bash
# apt
curl -fsSL https://example.com/keys/releases.gpg | sudo tee /etc/apt/keyrings/example.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/example.gpg] https://example.com/apt stable main" | sudo tee /etc/apt/sources.list.d/example.list
sudo apt update && sudo apt install project

# dnf
sudo rpm --import https://example.com/keys/releases.gpg
sudo tee /etc/yum.repos.d/example.repo <<EOF
[example]
name=Example Stable
baseurl=https://example.com/dnf
gpgcheck=1
gpgkey=https://example.com/keys/releases.gpg
EOF
sudo dnf install project
```

## Common pitfalls

- **Gatekeeper rejects DMG offline** → forgot `xcrun stapler staple`
- **Auto-updater signature verify fails** → public key in `tauri.conf.json` doesn't match signing private key
- **`apt update` says "NO_PUBKEY"** → user hasn't imported the public key into `/etc/apt/keyrings/`
- **rpms install but `dnf install` complains about repo metadata** → `repomd.xml` not signed (`gpg --detach-sign --armor` it)
- **macOS notarization rejects with "missing entitlements"** → `entitlements.plist` missing `com.apple.security.cs.allow-jit` and friends required for hardened runtime
- **`notarytool` returns Invalid status** → use `xcrun notarytool log <submission-id> --key-id ... --key ... --issuer ...` to read the actual rejection reason

## References

- https://tauri.app/distribute/sign/macos/
- https://tauri.app/plugin/updater/
- https://www.aptly.info/
- https://github.com/jedisct1/minisign
- https://docs.fedoraproject.org/en-US/quick-docs/creating-rpm-packages/
