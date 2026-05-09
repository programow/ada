//! macOS permission checks.
//!
//! - Microphone: `AVCaptureDevice.authorizationStatusForMediaType:` and the
//!   matching async request method, via `objc2-av-foundation`.
//! - Accessibility: `AXIsProcessTrustedWithOptions` from
//!   `ApplicationServices.framework`, called directly via `extern "C"` since
//!   `core-graphics 0.24` only re-exports the screen-capture access pair.
//! - Settings deep links: `open x-apple.systempreferences:...`.

use super::{PermissionState, SettingsPanel};
use crate::audio::AudioError;
use objc2::runtime::Bool;
use objc2_av_foundation::{AVAuthorizationStatus, AVCaptureDevice, AVMediaTypeAudio};
use std::process::Command;
use std::sync::mpsc;
use std::time::Duration;

pub fn check_microphone_permission() -> PermissionState {
    // SAFETY: `authorizationStatusForMediaType:` is a class method on
    // `AVCaptureDevice` and is documented as safe to call from any thread
    // for `AVMediaTypeAudio`. The framework returns one of the four
    // documented status values.
    let media_type = match unsafe { AVMediaTypeAudio } {
        Some(t) => t,
        // The symbol is declared `Option<&'static AVMediaType>`. In practice
        // it is never `None` on a system that links AVFoundation, but we
        // surface that as `NotDetermined` rather than panicking.
        None => return PermissionState::NotDetermined,
    };
    let status = unsafe { AVCaptureDevice::authorizationStatusForMediaType(media_type) };
    map_status(status)
}

pub fn request_microphone_permission() -> Result<PermissionState, AudioError> {
    let media_type = match unsafe { AVMediaTypeAudio } {
        Some(t) => t,
        None => return Ok(PermissionState::NotDetermined),
    };

    let (tx, rx) = mpsc::channel::<bool>();
    // The completion handler may fire on an arbitrary dispatch queue; the
    // closure only sends a bool down a channel, which is `Send`.
    let block = block2::RcBlock::new(move |granted: Bool| {
        let _ = tx.send(granted.as_bool());
    });

    // SAFETY: `requestAccessForMediaType:completionHandler:` is documented to
    // accept `AVMediaTypeAudio` and to invoke the handler exactly once. The
    // block is retained by the framework for the duration of the request.
    unsafe {
        AVCaptureDevice::requestAccessForMediaType_completionHandler(media_type, &block);
    }

    // The system prompt is shown only on the first request; subsequent calls
    // resolve immediately. A 60s ceiling protects against a hung dispatch.
    let granted = rx
        .recv_timeout(Duration::from_secs(60))
        .map_err(|_| AudioError::CaptureFailed("permission prompt timeout".into()))?;
    Ok(if granted {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    })
}

pub fn check_accessibility_permission() -> PermissionState {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    // SAFETY: `kAXTrustedCheckOptionPrompt` is a `CFStringRef` constant
    // exported from ApplicationServices.framework, valid for the lifetime of
    // the process. We pass `false` so this call never raises a UI prompt; the
    // caller decides whether to escalate to `open_settings_accessibility_panel`.
    let prompt_key =
        unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
    let no = CFBoolean::false_value();
    let dict = CFDictionary::from_CFType_pairs(&[(prompt_key, no)]);
    let trusted = unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef()) };
    if trusted {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    }
}

pub fn request_accessibility_permission() -> Result<(), AudioError> {
    // macOS does not provide a programmatic prompt API for accessibility —
    // the only path is to deep-link the user into System Settings.
    open_settings_panel_impl(SettingsPanel::Accessibility)
}

pub fn open_settings_panel_impl(panel: SettingsPanel) -> Result<(), AudioError> {
    let url = match panel {
        SettingsPanel::Microphone => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        SettingsPanel::Accessibility => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        }
    };
    Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| AudioError::CaptureFailed(format!("open settings failed: {e}")))?;
    Ok(())
}

fn map_status(status: AVAuthorizationStatus) -> PermissionState {
    // `AVAuthorizationStatus` is a `#[repr(transparent)]` struct around
    // `NSInteger` with associated constants, so this is a value match — not
    // an exhaustive enum match — and needs a default arm.
    match status {
        AVAuthorizationStatus::Authorized => PermissionState::Granted,
        AVAuthorizationStatus::Denied | AVAuthorizationStatus::Restricted => {
            PermissionState::Denied
        }
        AVAuthorizationStatus::NotDetermined => PermissionState::NotDetermined,
        _ => PermissionState::NotDetermined,
    }
}

// ApplicationServices.framework C symbols. The Swift bindings (`AXIsProcessTrustedWithOptions`,
// `kAXTrustedCheckOptionPrompt`) are not re-exported by `core-graphics 0.24`, so we link them
// directly. `boolean_t` on macOS is a 32-bit signed int, but Apple's headers declare the
// return as `Boolean` (unsigned char) for AX trust checks; we match that with `bool` since
// Rust's `bool` is FFI-compatible with `_Bool` (1 byte).
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    static kAXTrustedCheckOptionPrompt: core_foundation::string::CFStringRef;
    fn AXIsProcessTrustedWithOptions(
        options: core_foundation::dictionary::CFDictionaryRef,
    ) -> bool;
}
