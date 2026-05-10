pub mod audio;
pub mod clipboard;
pub mod commands;
pub mod history;
#[cfg(target_os = "macos")]
pub mod overlay_panel;
pub mod paste;
pub mod secrets;
pub mod settings;
pub mod shortcut;
pub mod tray;

use std::sync::Arc;

use audio::microphone::MicrophoneSource;
use clipboard::TauriClipboard;
use commands::AppState;
use paste::EnigoPaster;
use secrets::keyring_vault::KeyringVault;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

fn default_record_shortcut() -> Shortcut {
    let modifiers = if cfg!(target_os = "macos") {
        Modifiers::SUPER | Modifiers::SHIFT
    } else {
        Modifiers::CONTROL | Modifiers::SHIFT
    };
    Shortcut::new(Some(modifiers), Code::Space)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

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
            commands::paste_text,
        ])
        .setup(|app| {
            log::info!("voxera setup: building AppState with TauriClipboard");
            let clipboard = Arc::new(TauriClipboard::new(app.handle().clone()));
            let app_state = AppState {
                audio: Box::new(MicrophoneSource::new()),
                vault: Box::new(KeyringVault::new()),
                paster: Box::new(EnigoPaster::new(clipboard)),
            };
            app.manage(app_state);

            tray::build(app.handle())?;

            // macOS: convert the overlay window to a non-activating NSPanel
            // so clicks on the Stop button / drag handle don't yank focus
            // away from whatever app the user is dictating into.
            #[cfg(target_os = "macos")]
            if let Some(overlay_window) = app.get_webview_window("overlay") {
                if let Err(e) = overlay_panel::make_overlay_nonactivating(&overlay_window) {
                    log::warn!("overlay panel conversion failed: {e}");
                }
            }

            // Tray-resident behaviour: closing the main window hides it and
            // (on macOS) hides the Dock icon, instead of quitting the app.
            // Re-open via the tray "Open Vox Era" item, which reverses this.
            if let Some(main_window) = app.get_webview_window("main") {
                let main_window_for_close = main_window.clone();
                let app_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_window_for_close.hide();
                        #[cfg(target_os = "macos")]
                        {
                            let _ = app_handle
                                .set_activation_policy(tauri::ActivationPolicy::Accessory);
                        }
                        // Reference app_handle on non-macOS too so the closure
                        // doesn't drop it as unused.
                        #[cfg(not(target_os = "macos"))]
                        let _ = &app_handle;
                    }
                });
            }

            let shortcut = default_record_shortcut();
            app.global_shortcut().on_shortcut(shortcut, |app, _, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = app.emit("vox-era://shortcut-toggle", ());
                }
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vox Era");
}
