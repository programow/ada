// Per-platform permission code lands in Tasks 6-8.
//
// These stubs exist so that `MicrophoneSource` (Task 4) compiles and links
// before the platform-specific implementations are in place. Tasks 6-8 will
// replace this file with real macOS/Windows/Linux permission handling.

use super::{AudioError, PermissionState};

pub fn check_microphone_permission() -> PermissionState {
    PermissionState::NotDetermined
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    Ok(PermissionState::NotDetermined)
}
