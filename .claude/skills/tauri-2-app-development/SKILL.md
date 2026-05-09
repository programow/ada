---
name: tauri-2-app-development
description: Use when working on Tauri 2.x desktop apps — building commands, configuring capabilities, setting up plugins, defining multiple windows, or troubleshooting "command not callable" / "permission denied" errors from the webview
---

# Tauri 2 app development

Tauri 2 made breaking changes from v1 that aren't always obvious from project scaffolds. Reference points for getting it right.

## Capabilities replaced allowlist

Tauri 1 had `tauri.conf.json > tauri.allowlist`. **Tauri 2 uses capabilities** in `src-tauri/capabilities/*.json`. Each plugin requires explicit permission grants — none enabled by default.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main", "overlay"],
  "permissions": [
    "core:default",
    "global-shortcut:allow-register",
    "clipboard-manager:allow-write-text",
    "sql:default",
    "store:default",
    "updater:default"
  ]
}
```

If a plugin call from JS silently fails or returns "Not authorized", the missing permission is in this file.

## Plugin registration in Rust

Plugins must be added to the Tauri builder; capabilities only matter once the plugin is registered:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_sql::Builder::default()
        .add_migrations(DB_URL, migrations())
        .build())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![/* commands */])
    .setup(|app| { /* programmatic setup */ Ok(()) })
    .run(tauri::generate_context!())
```

## tauri-plugin-sql migrations are registered in Rust, NOT discovered

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create transcriptions table",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}
```

The plugin does NOT auto-discover SQL files. The `migrations/` folder is a source-file convention only.

## Multi-window setup

- **Static windows** — declare in `tauri.conf.json` (`app.windows[]`). Best for windows known at build time (main UI, overlay).
- **Dynamic windows** — create programmatically via `WebviewWindowBuilder` in Rust. Best for windows opened on demand.
- **Tray is NOT a window** — it's a `TrayIconBuilder` + `Menu` in the `setup` callback. No HTML, no React, just native menu items.

## macOS Info.plist + entitlements

```json
"bundle": {
  "macOS": {
    "entitlements": "entitlements.plist",
    "infoPlist": {
      "NSMicrophoneUsageDescription": "Required for transcription.",
      "LSUIElement": true
    }
  }
}
```

The key is **`infoPlist`** (object merged into Info.plist). Older Tauri docs reference `extendInfo` — verify against `MacConfig` at https://tauri.app/reference/config/. Entitlements path is relative to `src-tauri/`.

## Common pitfalls

- **JS plugin call fails silently** → missing permission in capabilities file
- **macOS app crashes on first mic access** → missing `NSMicrophoneUsageDescription` in `infoPlist`
- **`cargo build` fails with "tauri-build" not found** → missing `tauri-build` in `[build-dependencies]`
- **`cargo test` fails with platform-specific symbols** → wrap in `#[cfg(target_os = "...")]`
- **Migration runs twice / fails on second app start** → plugin uses an internal `__pulumi_migrations` table; don't manually re-run migrations
- **Tray menu items don't fire** → forgot `.on_menu_event(...)` callback on the `TrayIconBuilder`

## References

- https://tauri.app/security/capabilities/
- https://tauri.app/develop/calling-rust/
- https://tauri.app/plugin/sql/
- https://tauri.app/plugin/store/
- https://tauri.app/plugin/clipboard-manager/
- https://tauri.app/plugin/global-shortcut/
- https://tauri.app/learn/system-tray/
- https://tauri.app/reference/config/
