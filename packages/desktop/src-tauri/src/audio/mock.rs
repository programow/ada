use super::{AudioError, AudioSource, CaptureSession, PermissionState};
use std::sync::Mutex;
use uuid::Uuid;

pub struct MockMicrophoneSource {
    pub permission: Mutex<PermissionState>,
    pub canned_wav: Vec<u8>,
    pub last_device: Mutex<Option<String>>,
}

impl MockMicrophoneSource {
    pub fn new(permission: PermissionState, canned_wav: Vec<u8>) -> Self {
        Self {
            permission: Mutex::new(permission),
            canned_wav,
            last_device: Mutex::new(None),
        }
    }

    pub fn last_requested_device_id(&self) -> Option<String> {
        self.last_device.lock().unwrap().clone()
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

    fn start_capture_with_device(
        &self,
        device_id: Option<&str>,
    ) -> Result<CaptureSession, AudioError> {
        *self.last_device.lock().unwrap() = device_id.map(str::to_string);
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

    #[test]
    fn start_capture_with_device_routes_to_default_when_none() {
        let m = MockMicrophoneSource::new(PermissionState::Granted, b"abc".to_vec());
        let s = m.start_capture_with_device(None).unwrap();
        let bytes = m.stop_capture(&s).unwrap();
        assert_eq!(bytes, b"abc");
    }

    #[test]
    fn start_capture_with_device_records_requested_id() {
        let m = MockMicrophoneSource::new(PermissionState::Granted, b"abc".to_vec());
        let _ = m.start_capture_with_device(Some("USB Mic")).unwrap();
        assert_eq!(m.last_requested_device_id(), Some("USB Mic".to_string()));
    }
}
