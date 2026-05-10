use crate::audio::{AudioDeviceInfo, AudioSource, CaptureSession, PermissionState, microphone::MicrophoneSource};
use crate::paste::Paster;
use crate::secrets::Vault;
use crate::shortcut::parse::{format_combo, parse_combo};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use uuid::Uuid;

/// Application state shared across Tauri commands.
///
/// Each field is a trait object so production wiring (real impls) can be
/// swapped for in-memory mocks in tests. The clipboard is owned by the
/// `Paster` (per spec §6.10 — `paste_text` combines clipboard write +
/// keystroke), so it does not appear here as a separate field.
///
/// `current_hotkey` tracks the currently registered global shortcut so
/// `register_hotkey` can unregister the previous combo before binding a
/// new one. The JS side owns hotkey lifecycle on app start (per spec).
pub struct AppState {
    pub audio: Box<dyn AudioSource>,
    pub vault: Box<dyn Vault>,
    pub paster: Box<dyn Paster>,
    pub current_hotkey: Mutex<Option<Shortcut>>,
}

#[tauri::command]
pub fn check_microphone_permission(state: State<'_, AppState>) -> PermissionState {
    state.audio.check_permission()
}

#[tauri::command]
pub fn request_microphone_permission(
    state: State<'_, AppState>,
) -> Result<PermissionState, String> {
    state.audio.request_permission().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_accessibility_permission() -> PermissionState {
    crate::audio::permissions::check_accessibility_permission()
}

#[tauri::command]
pub fn request_accessibility_permission() -> Result<(), String> {
    crate::audio::permissions::request_accessibility_permission().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_settings_panel(panel: String) -> Result<(), String> {
    use crate::audio::permissions::{
        open_settings_accessibility_panel, open_settings_microphone_panel,
    };
    match panel.as_str() {
        "microphone" => open_settings_microphone_panel().map_err(|e| e.to_string()),
        "accessibility" => open_settings_accessibility_panel().map_err(|e| e.to_string()),
        other => Err(format!("unknown panel: {other}")),
    }
}

#[tauri::command]
pub fn start_recording(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<String, String> {
    let session = state
        .audio
        .start_capture_with_device(device_id.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(session.id.to_string())
}

#[tauri::command]
pub fn stop_recording(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<u8>, String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    let session = CaptureSession { id };
    state.audio.stop_capture(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(
    state: State<'_, AppState>,
    secret_id: String,
) -> Result<Option<String>, String> {
    let opt = state.vault.get(&secret_id).map_err(|e| e.to_string())?;
    Ok(opt.map(|z| z.to_string()))
}

#[tauri::command]
pub fn set_secret(
    state: State<'_, AppState>,
    secret_id: String,
    key: String,
) -> Result<(), String> {
    state
        .vault
        .set(&secret_id, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_secret(state: State<'_, AppState>, secret_id: String) -> Result<(), String> {
    state.vault.delete(&secret_id).map_err(|e| e.to_string())
}

/// Combined clipboard write + paste keystroke (Cmd+V on macOS, Ctrl+V
/// elsewhere). The paster owns the clipboard internally per spec §6.10.
#[tauri::command]
pub fn paste_text(state: State<'_, AppState>, text: String) -> Result<(), String> {
    state.paster.paste_text(&text)
}

#[tauri::command]
pub fn list_audio_input_devices() -> Vec<AudioDeviceInfo> {
    MicrophoneSource::list_devices().unwrap_or_default()
}

#[tauri::command]
pub fn register_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
    combo: String,
) -> Result<String, String> {
    let shortcut = parse_combo(&combo).map_err(|e| e.to_string())?;
    let mut current = state.current_hotkey.lock().map_err(|e| e.to_string())?;
    if let Some(prev) = current.take() {
        let _ = app.global_shortcut().unregister(prev);
    }
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app_clone.emit("vox-era://shortcut-toggle", ());
            }
        })
        .map_err(|e| e.to_string())?;
    *current = Some(shortcut);
    Ok(format_combo(&shortcut))
}

#[tauri::command]
pub fn unregister_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut current = state.current_hotkey.lock().map_err(|e| e.to_string())?;
    if let Some(prev) = current.take() {
        app.global_shortcut()
            .unregister(prev)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
