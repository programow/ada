//! Migrations registration for `tauri-plugin-sql`. The actual data
//! access lives in JS (`packages/desktop/src/lib/db.ts`).

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:vox-era.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create transcriptions table and indexes",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create api_keys, model_configs, app_state tables",
            sql: include_str!("../../migrations/0002_provider_configs.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
