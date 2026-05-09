use super::{AudioError, PermissionState};

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

/// Settings panel that can be deep-linked from a host OS preferences app.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsPanel {
    Microphone,
    Accessibility,
}

/// Open the platform's privacy panel for microphone access.
pub fn open_settings_microphone_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Microphone)
}

/// Open the platform's privacy panel for accessibility / input-monitoring access.
pub fn open_settings_accessibility_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Accessibility)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `check_microphone_permission` is wired up on every supported platform
    /// and returns a value (we don't assert which — a CI runner has no mic
    /// consent record, a developer machine almost certainly does).
    #[test]
    fn check_microphone_permission_returns_a_state() {
        let state = check_microphone_permission();
        // Just exercise the discriminants so a future enum widening trips this.
        match state {
            PermissionState::Granted
            | PermissionState::Denied
            | PermissionState::NotDetermined => {}
        }
    }

    /// `check_accessibility_permission` is exposed by every platform module
    /// (Windows + Linux always return Granted; macOS calls AXIsProcessTrustedWithOptions).
    #[test]
    fn check_accessibility_permission_returns_a_state() {
        let state = check_accessibility_permission();
        match state {
            PermissionState::Granted
            | PermissionState::Denied
            | PermissionState::NotDetermined => {}
        }
    }

    /// The shared `SettingsPanel` enum should expose distinct variants for the
    /// two privacy panels we deep-link to.
    #[test]
    fn settings_panel_variants_are_distinct() {
        assert_ne!(SettingsPanel::Microphone, SettingsPanel::Accessibility);
    }
}
