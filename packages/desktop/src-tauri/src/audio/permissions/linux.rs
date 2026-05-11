//! Linux permission checks.
//!
//! Linux has no first-class consent system for microphone access (PulseAudio,
//! PipeWire, and ALSA all rely on file-system permissions on `/dev/snd/*` plus
//! per-distro sandboxing such as Flatpak Portals). We therefore probe whether
//! cpal can open a default input device and treat success as `Granted`.
//!
//! There is also no standardized deep link to a privacy panel; we surface
//! that as an `AudioError` so the caller can show a manual instruction.

use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;

pub fn check_microphone_permission() -> PermissionState {
    use cpal::traits::HostTrait;
    if cpal::default_host().default_input_device().is_some() {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    }
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    Ok(check_microphone_permission())
}

pub fn check_accessibility_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn check_accessibility_permission_prompting() -> PermissionState {
    // No AX trust system on Linux; the prompting variant is a no-op.
    PermissionState::Granted
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    Ok(())
}

/// X11 / Wayland have no per-app input-event-monitoring gate analogous to
/// macOS's `kTCCServiceListenEvent`. Wayland *does* restrict global key
/// capture at the compositor level, but that's a different model with no
/// consent prompt to drive; treat as `Granted` and let the shortcut backend
/// surface its own errors if registration fails.
pub fn check_input_monitoring_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn request_input_monitoring_permission() -> Result<PermissionState, AudioError> {
    Ok(PermissionState::Granted)
}

pub fn open_settings_panel_impl(_panel: SettingsPanel) -> Result<(), AudioError> {
    Err(AudioError::CaptureFailed(
        "Linux has no standardized settings panel deep link; please open your desktop's audio settings manually".into(),
    ))
}
