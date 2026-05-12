# Build & Release

> **This doc is a Plan D deliverable.** The full local-build + signing + notarization + release-pipeline walkthrough lands in Plan D.

Until then:

- **Local clean build & install (macOS):** `/build-clean` slash command (defined in `.claude/commands/build-clean.md`). Runs `tauri build`, copies the bundle into `/Applications/Vox Era.app`, performs a TCC reset so a fresh permission flow can be exercised.
- **Dev loop:** `/dev-desktop` (Vite + cargo watch).
- **CI release workflow:** `.github/workflows/release.yml`. Currently builds the macOS bundle on tag pushes; Linux and Windows targets are temporarily disabled (see commit `99c5b37`).

The Plan D rewrite of this doc will cover:

- Apple Developer ID signing + notarytool stapling.
- Minisign keypair generation and the auto-update manifest.
- Linux GPG-signed deb / rpm + self-hosted apt / dnf repository metadata.
- S3 + CloudFront publication and CloudFront invalidation.
- GitHub Releases artifact upload via OIDC.

For architecture, see [`architecture.md`](./architecture.md). For macOS permissions wired into the bundle, see [`permissions.md`](./permissions.md).
