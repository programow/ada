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
///
/// On macOS, Accessibility and Input Monitoring are *distinct* TCC buckets:
/// - `Accessibility` gates `CGEventPost` (synthetic keystrokes for paste).
/// - `InputMonitoring` gates `CGEventTap` (the Fn-key listener).
///   The classic mistake is to ask for Accessibility when the failure is
///   actually Input Monitoring; granting Accessibility alone does not fix
///   the Fn tap.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsPanel {
    Microphone,
    Accessibility,
    InputMonitoring,
}

/// Open the platform's privacy panel for microphone access.
pub fn open_settings_microphone_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Microphone)
}

/// Open the platform's privacy panel for accessibility access.
///
/// Accessibility on macOS gates `CGEventPost` — i.e. the synthetic paste
/// keystroke. For the Fn-key tap, use [`open_settings_input_monitoring_panel`]
/// instead.
pub fn open_settings_accessibility_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::Accessibility)
}

/// Open the platform's privacy panel for input-monitoring access.
///
/// Input Monitoring on macOS gates `CGEventTap` (the Fn-key listener);
/// it is a separate TCC bucket from Accessibility.
pub fn open_settings_input_monitoring_panel() -> Result<(), AudioError> {
    open_settings_panel_impl(SettingsPanel::InputMonitoring)
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

    /// `check_accessibility_permission_prompting` mirrors the non-prompting
    /// variant but with `prompt:true`. The macOS dialog (if any) is rate-limited
    /// by the OS so calling this in tests is harmless.
    #[test]
    fn check_accessibility_permission_prompting_returns_a_state() {
        let state = check_accessibility_permission_prompting();
        match state {
            PermissionState::Granted
            | PermissionState::Denied
            | PermissionState::NotDetermined => {}
        }
    }

    /// `check_input_monitoring_permission` is exposed by every platform module
    /// (Windows + Linux always return Granted; macOS calls
    /// `CGPreflightListenEventAccess`).
    #[test]
    fn check_input_monitoring_permission_returns_a_state() {
        let state = check_input_monitoring_permission();
        match state {
            PermissionState::Granted
            | PermissionState::Denied
            | PermissionState::NotDetermined => {}
        }
    }

    /// The shared `SettingsPanel` enum should expose distinct variants for each
    /// privacy panel we deep-link to. Accessibility and Input Monitoring in
    /// particular are different TCC buckets on macOS and must not collapse.
    #[test]
    fn settings_panel_variants_are_distinct() {
        assert_ne!(SettingsPanel::Microphone, SettingsPanel::Accessibility);
        assert_ne!(SettingsPanel::Microphone, SettingsPanel::InputMonitoring);
        assert_ne!(
            SettingsPanel::Accessibility,
            SettingsPanel::InputMonitoring
        );
    }
}
