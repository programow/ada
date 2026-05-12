//! Windows permission checks.
//!
//! - Microphone: read the per-app consent value from
//!   `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\
//!   ConsentStore\microphone\Value`. Values are documented as
//!   `Allow` / `Deny` / `Prompt`.
//! - Accessibility: Windows has no equivalent gate, so we always return
//!   `Granted`.
//! - Settings deep links: `ms-settings:` URIs.

use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;
use std::process::Command;
use windows::core::w;
use windows::Win32::System::Registry::{
    RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_SZ,
};

pub fn check_microphone_permission() -> PermissionState {
    let path = w!("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone");
    // SAFETY: All pointers passed in (`path`, `"Value"`, the local buffers,
    // and `&mut hkey`/`&mut size`/`&mut kind`) outlive the calls.
    unsafe {
        let mut hkey = HKEY::default();
        if RegOpenKeyExW(HKEY_CURRENT_USER, path, 0, KEY_READ, &mut hkey).is_err() {
            return PermissionState::NotDetermined;
        }
        let mut buf = [0u16; 32];
        let mut size = (buf.len() * 2) as u32;
        let mut kind = REG_SZ;
        let read = RegQueryValueExW(
            hkey,
            w!("Value"),
            None,
            Some(&mut kind),
            Some(buf.as_mut_ptr() as *mut u8),
            Some(&mut size),
        );
        if read.is_err() {
            return PermissionState::NotDetermined;
        }
        // `size` is in bytes; the returned string is null-terminated when stored
        // as `REG_SZ`, so trim the trailing NUL.
        let len_u16 = (size as usize / 2).saturating_sub(1);
        let s = String::from_utf16_lossy(&buf[..len_u16]);
        match s.as_str() {
            "Allow" => PermissionState::Granted,
            "Deny" => PermissionState::Denied,
            _ => PermissionState::NotDetermined,
        }
    }
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    // Windows has no programmatic consent prompt for desktop apps; the only
    // path is to send the user to the privacy panel and re-check on return.
    open_settings_panel_impl(SettingsPanel::Microphone)?;
    Ok(check_microphone_permission())
}

pub fn check_accessibility_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn check_accessibility_permission_prompting() -> PermissionState {
    // Windows has no AX trust dialog; the prompting variant is a no-op.
    PermissionState::Granted
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    Ok(())
}

/// Input Monitoring has no Windows equivalent gate — desktop apps can
/// install low-level keyboard hooks without per-app consent.
pub fn check_input_monitoring_permission() -> PermissionState {
    PermissionState::Granted
}

pub fn request_input_monitoring_permission() -> Result<PermissionState, AudioError> {
    Ok(PermissionState::Granted)
}

pub fn open_settings_panel_impl(panel: SettingsPanel) -> Result<(), AudioError> {
    let uri = match panel {
        SettingsPanel::Microphone => "ms-settings:privacy-microphone",
        SettingsPanel::Accessibility => "ms-settings:easeofaccess",
        // Windows doesn't have a dedicated Input Monitoring page; the root
        // Privacy pane is the closest equivalent.
        SettingsPanel::InputMonitoring => "ms-settings:privacy",
    };
    Command::new("cmd")
        .args(["/C", "start", "", uri])
        .status()
        .map_err(|e| AudioError::CaptureFailed(format!("open settings failed: {e}")))?;
    Ok(())
}
