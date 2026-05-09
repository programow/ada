use super::{AudioError, AudioSource, CaptureSession, PermissionState};
use std::sync::Mutex;
use uuid::Uuid;

pub struct MockMicrophoneSource {
    pub permission: Mutex<PermissionState>,
    pub canned_wav: Vec<u8>,
}

impl MockMicrophoneSource {
    pub fn new(permission: PermissionState, canned_wav: Vec<u8>) -> Self {
        Self {
            permission: Mutex::new(permission),
            canned_wav,
        }
    }
}

impl AudioSource for MockMicrophoneSource {
    fn check_permission(&self) -> PermissionState {
        *self.permission.lock().unwrap()
    }

    fn request_permission(&self) -> Result<PermissionState, AudioError> {
        let mut p = self.permission.lock().unwrap();
        if *p == PermissionState::NotDetermined {
            *p = PermissionState::Granted;
        }
        Ok(*p)
    }

    fn start_capture(&self) -> Result<CaptureSession, AudioError> {
        if self.check_permission() != PermissionState::Granted {
            return Err(AudioError::PermissionDenied);
        }
        Ok(CaptureSession { id: Uuid::new_v4() })
    }

    fn stop_capture(&self, _session: &CaptureSession) -> Result<Vec<u8>, AudioError> {
        Ok(self.canned_wav.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denied_permission_blocks_capture() {
        let mock = MockMicrophoneSource::new(PermissionState::Denied, vec![]);
        assert!(matches!(mock.start_capture(), Err(AudioError::PermissionDenied)));
    }

    #[test]
    fn granted_permission_returns_canned_wav() {
        let canned = vec![1, 2, 3];
        let mock = MockMicrophoneSource::new(PermissionState::Granted, canned.clone());
        let session = mock.start_capture().unwrap();
        let bytes = mock.stop_capture(&session).unwrap();
        assert_eq!(bytes, canned);
    }

    #[test]
    fn request_promotes_not_determined_to_granted() {
        let mock = MockMicrophoneSource::new(PermissionState::NotDetermined, vec![]);
        let p = mock.request_permission().unwrap();
        assert_eq!(p, PermissionState::Granted);
    }
}
