pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod history;
pub mod paste;
pub mod secrets;
pub mod settings;
pub mod shortcut;
pub mod tray;

use std::sync::Arc;

use audio::microphone::MicrophoneSource;
use clipboard::InMemoryClipboard;
use commands::AppState;
use paste::EnigoPaster;
use secrets::keyring_vault::KeyringVault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let clipboard = Arc::new(InMemoryClipboard::new());
    let app_state = AppState {
        audio: Box::new(MicrophoneSource::new()),
        vault: Box::new(KeyringVault::new(vec![])),
        paster: Box::new(EnigoPaster::new(clipboard)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(history::DB_URL, history::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::check_microphone_permission,
            commands::request_microphone_permission,
            commands::check_accessibility_permission,
            commands::request_accessibility_permission,
            commands::open_settings_panel,
            commands::start_recording,
            commands::stop_recording,
            commands::get_secret,
            commands::set_secret,
            commands::delete_secret,
            commands::list_configured_providers,
            commands::paste_text,
        ])
        .setup(|app| {
            tray::build(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
