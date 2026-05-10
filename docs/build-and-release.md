# Build & Release

> **This doc is being rewritten in Plan D.** The previous version covered the
> Electron-era ritual (`npm run build`, `electron-builder`, `paste-helper.swift`,
> manual `codesign --deep` re-sign). That ritual no longer applies — Vox Era is
> Tauri 2 with bundle id `com.vhtechnology.voxera`.
>
> Until Plan D lands the full Tauri-era content here, see:
>
> - **Local clean build:** `/build-clean` slash command (defined in
>   `.claude/commands/build-clean.md`)
> - **Tauri dev loop:** `/dev-desktop` slash command
> - **Architecture overview:** [`architecture.md`](./architecture.md)
> - **macOS permissions (Microphone + Accessibility):** [`permissions.md`](./permissions.md)
> - **Signed-release pipeline (CI tag-triggered):** to be documented as part of
>   Plan D — covers Apple Developer ID + notarization, Linux GPG-signed deb/rpm,
>   minisign auto-update manifest, S3 + CloudFront publication, GitHub Releases.
