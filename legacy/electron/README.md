# Legacy Electron Ada

This folder contains the original macOS-only Electron speech-to-text app, preserved as a reference during the Tauri migration.

**Status:** archived, not actively maintained. bluemacaw is the supported app at `packages/desktop/` once Plan B ships.

**Original config:** macOS DMG via electron-builder, signed via Apple Developer ID, paste via `paste-helper.swift`. See git history for build instructions.

**Removal:** this directory will be deleted at the end of Plan D once bluemacaw reaches feature parity (per spec §5 Phase 4).

**Run the legacy app (if needed for behavior comparison):**

```bash
cd legacy/electron
npm install
npm start
```

(Note: requires the original `config.json` with an OpenAI API key.)
