use crate::audio::{AudioDeviceInfo, AudioSource, CaptureSession, PermissionState, microphone::MicrophoneSource};
use crate::paste::Paster;
use crate::secrets::Vault;
use crate::shortcut::parse::{format_combo, parse_combo};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use uuid::Uuid;

#[cfg(target_os = "macos")]
use crate::shortcut::{HotkeyCombo, ShortcutManager, macos_fn::MacOsFnTap};

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
    /// macOS Fn-key tap. Lazily initialized the first time the user picks
    /// `"Fn"` as their hotkey. Once running it survives the app lifetime
    /// (CFRunLoop has no clean stop in v1); switching back to a standard
    /// combo just unregisters the global shortcut, the dormant tap stays.
    #[cfg(target_os = "macos")]
    pub fn_tap: Mutex<Option<Arc<MacOsFnTap>>>,
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

/// Same TCC bucket as [`check_accessibility_permission`] but uses
/// `prompt:true` under the hood so the first invocation when the process
/// is not yet trusted raises the native macOS "Open System Settings"
/// dialog. Frontend convention: call this on an explicit user gesture
/// (e.g. clicking the "Grant Accessibility" button) and call the
/// non-prompting variant during passive status polling.
#[tauri::command]
pub fn check_accessibility_permission_prompting() -> PermissionState {
    crate::audio::permissions::check_accessibility_permission_prompting()
}

#[tauri::command]
pub fn request_accessibility_permission() -> Result<(), String> {
    crate::audio::permissions::request_accessibility_permission().map_err(|e| e.to_string())
}

/// Input Monitoring status — the permission the Fn-key `CGEventTap` needs.
/// Distinct from Accessibility on macOS (`kTCCServiceListenEvent` vs
/// `kTCCServiceAccessibility`).
#[tauri::command]
pub fn check_input_monitoring_permission() -> PermissionState {
    crate::audio::permissions::check_input_monitoring_permission()
}

/// Kick off the macOS Input Monitoring authorization flow via
/// `CGRequestListenEventAccess`. The OS dialog appears asynchronously and
/// the grant only takes effect after the user toggles the switch *and*
/// the app is relaunched (TCC does not propagate authorization changes to
/// a running process). Callers should poll
/// [`check_input_monitoring_permission`] and prompt the user to quit and
/// reopen Vox Era.
#[tauri::command]
pub fn request_input_monitoring_permission() -> Result<PermissionState, String> {
    crate::audio::permissions::request_input_monitoring_permission()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_settings_panel(panel: String) -> Result<(), String> {
    use crate::audio::permissions::{
        open_settings_accessibility_panel, open_settings_input_monitoring_panel,
        open_settings_microphone_panel,
    };
    match panel.as_str() {
        "microphone" => open_settings_microphone_panel().map_err(|e| e.to_string()),
        "accessibility" => open_settings_accessibility_panel().map_err(|e| e.to_string()),
        "input-monitoring" => {
            open_settings_input_monitoring_panel().map_err(|e| e.to_string())
        }
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

/// Returns the loudest sample amplitude observed since the previous call,
/// normalized to 0.0..=1.0. The Rust side resets the tracked peak on each
/// read, so polling this at ~12 Hz produces a smooth meter that decays
/// naturally to zero when the user stops speaking.
///
/// Returns 0.0 when the session isn't known to the audio source (e.g. the
/// mock impl doesn't track levels) so the UI never has to special-case a
/// missing meter.
#[tauri::command]
pub fn get_recording_level(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<f32, String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    let session = CaptureSession { id };
    Ok(state.audio.peak_level(&session).unwrap_or(0.0))
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
///
/// On macOS, `enigo` synthesises the keystroke via `CGEventPost`, which silently
/// no-ops when the bound process lacks Accessibility permission. We probe the
/// permission up front and return a structured `accessibility-required:` error
/// so the React side can surface a useful message instead of "text on
/// clipboard but nothing happened".
#[tauri::command]
pub fn paste_text(state: State<'_, AppState>, text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let perm = crate::audio::permissions::check_accessibility_permission();
        if perm != crate::audio::PermissionState::Granted {
            log::warn!(
                "paste_text: Accessibility permission not granted; keystroke will silently no-op"
            );
            return Err(
                "accessibility-required: synthetic paste needs Accessibility. Grant Vox Era in System Settings → Privacy & Security → Accessibility, then try again."
                    .to_string(),
            );
        }
    }
    log::info!(
        "paste_text: dispatching {} chars to clipboard + paste keystroke",
        text.chars().count()
    );
    let result = state.paster.paste_text(&text);
    #[cfg(target_os = "linux")]
    if let Err(ref e) = result {
        if e.starts_with("wayland-paste-unsupported:") {
            log::warn!(
                "paste_text: Wayland fallback engaged; clipboard write succeeded but synthetic Ctrl+V was skipped"
            );
        }
    }
    result
}

#[tauri::command]
pub fn list_audio_input_devices() -> Vec<AudioDeviceInfo> {
    MicrophoneSource::list_devices().unwrap_or_default()
}

/// Returns true if the user-supplied combo string is the special `"Fn"`
/// marker (case-insensitive, whitespace-tolerant) that routes to the
/// macOS-only `CGEventTap` backend instead of the cross-platform
/// global-shortcut plugin.
fn is_fn_combo(combo: &str) -> bool {
    combo.trim().eq_ignore_ascii_case("fn")
}

#[tauri::command]
pub fn register_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
    combo: String,
) -> Result<String, String> {
    if is_fn_combo(&combo) {
        return register_fn_hotkey(&app, &state);
    }
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

#[cfg(target_os = "macos")]
fn register_fn_hotkey(
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<String, String> {
    // Make sure no standard global shortcut is also live so we don't get
    // double-toggle from two backends.
    {
        let mut current = state.current_hotkey.lock().map_err(|e| e.to_string())?;
        if let Some(prev) = current.take() {
            let _ = app.global_shortcut().unregister(prev);
        }
    }
    let mut tap_slot = state.fn_tap.lock().map_err(|e| e.to_string())?;
    if tap_slot.is_some() {
        // Tap already running from a prior register; idempotent success.
        return Ok("Fn".to_string());
    }
    let app_clone = app.clone();
    let tap = Arc::new(MacOsFnTap::new(move || {
        let _ = app_clone.emit("vox-era://shortcut-toggle", ());
    }));
    tap.register(HotkeyCombo::Fn).map_err(|e| match e {
        crate::shortcut::ShortcutError::InputMonitoringRequired => {
            // TCC changes do NOT propagate to a running process. The user
            // must quit and reopen after toggling the switch, otherwise the
            // tap will keep failing even though Settings shows "on".
            "input-monitoring-required: grant Vox Era in System Settings → Privacy & Security → Input Monitoring, then quit and reopen the app".to_string()
        }
        crate::shortcut::ShortcutError::AccessibilityRequired => {
            // Defensive: the Fn tap should never surface this variant any
            // more, but if a future backend path does we still want a sane
            // message. Paste uses Accessibility — hence the wording.
            "accessibility-required: grant Vox Era in System Settings → Privacy & Security → Accessibility, then try again".to_string()
        }
        other => other.to_string(),
    })?;
    *tap_slot = Some(tap);
    Ok("Fn".to_string())
}

#[cfg(not(target_os = "macos"))]
fn register_fn_hotkey(
    _app: &AppHandle,
    _state: &State<'_, AppState>,
) -> Result<String, String> {
    Err("Fn key shortcut is only supported on macOS".to_string())
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
    // Note: the macOS Fn-key CGEventTap thread cannot be cleanly stopped
    // in v1. If a Fn tap is running it stays alive; switching to a standard
    // combo just leaves the tap dormant (it only fires on Fn presses).
    Ok(())
}

/// Read `defaults read com.apple.HIToolbox AppleFnUsageType`.
/// Returns `None` when the key has never been set (factory default).
/// 0 = Do Nothing, 1 = Change Input Source, 2 = Show Emoji & Symbols, 3 = Start Dictation.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_fn_usage_type() -> Result<Option<i32>, String> {
    let output = std::process::Command::new("defaults")
        .args(["read", "com.apple.HIToolbox", "AppleFnUsageType"])
        .output()
        .map_err(|e| format!("defaults read failed to launch: {e}"))?;
    if !output.status.success() {
        // `defaults read` exits non-zero when the key isn't set yet.
        return Ok(None);
    }
    let s = String::from_utf8_lossy(&output.stdout);
    let trimmed = s.trim();
    let n = trimmed
        .parse::<i32>()
        .map_err(|e| format!("unexpected defaults output {trimmed:?}: {e}"))?;
    Ok(Some(n))
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_fn_usage_type() -> Result<Option<i32>, String> {
    Err("Fn usage type is a macOS-only setting".into())
}

/// Write `defaults write com.apple.HIToolbox AppleFnUsageType -int <value>` and
/// `killall cfprefsd` so the change takes effect immediately without a logout.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn set_fn_usage_type(value: i32) -> Result<(), String> {
    let status = std::process::Command::new("defaults")
        .args([
            "write",
            "com.apple.HIToolbox",
            "AppleFnUsageType",
            "-int",
            &value.to_string(),
        ])
        .status()
        .map_err(|e| format!("defaults write failed to launch: {e}"))?;
    if !status.success() {
        return Err(format!(
            "defaults write exited with status {}",
            status.code().unwrap_or(-1)
        ));
    }
    // cfprefsd caches plists in-memory; without killing it the new value
    // is only picked up after the next logout.
    let _ = std::process::Command::new("killall")
        .arg("cfprefsd")
        .status();
    log::info!("AppleFnUsageType set to {value}");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn set_fn_usage_type(_value: i32) -> Result<(), String> {
    Err("Fn usage type is a macOS-only setting".into())
}
