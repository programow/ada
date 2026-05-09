use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod microphone;
pub mod mock;
pub mod permissions;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionState {
    Granted,
    Denied,
    NotDetermined,
}

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("microphone permission not granted")]
    PermissionDenied,
    #[error("audio device unavailable: {0}")]
    DeviceUnavailable(String),
    #[error("capture failed: {0}")]
    CaptureFailed(String),
}

pub struct CaptureSession {
    pub id: Uuid,
}

pub trait AudioSource: Send + Sync {
    fn check_permission(&self) -> PermissionState;
    fn request_permission(&self) -> Result<PermissionState, AudioError>;
    fn start_capture(&self) -> Result<CaptureSession, AudioError>;
    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_state_serializes() {
        let json = serde_json::to_string(&PermissionState::Granted).unwrap();
        assert_eq!(json, "\"Granted\"");
    }

    #[test]
    fn permission_state_deserializes() {
        let s: PermissionState = serde_json::from_str("\"Denied\"").unwrap();
        assert_eq!(s, PermissionState::Denied);
    }
}
