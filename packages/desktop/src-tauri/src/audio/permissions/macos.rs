//! macOS permission checks.
//!
//! - Microphone: `AVCaptureDevice.authorizationStatusForMediaType:` and the
//!   matching async request method, via `objc2-av-foundation`.
//! - Accessibility: `AXIsProcessTrustedWithOptions` from
//!   `ApplicationServices.framework`, called directly via `extern "C"` since
//!   `core-graphics 0.24` only re-exports the screen-capture access pair.
//!   Gates `CGEventPost` (synthetic paste keystroke).
//! - Input Monitoring: `CGPreflightListenEventAccess` /
//!   `CGRequestListenEventAccess` from `CoreGraphics.framework`. Gates
//!   `CGEventTap` (the Fn-key listener). This is a *different* TCC bucket
//!   from Accessibility (`kTCCServiceListenEvent` vs `kTCCServiceAccessibility`);
//!   the historical confusion is that both relate to keyboard events but
//!   they protect distinct operations (listen vs post).
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
    check_accessibility_permission_with_prompt(false)
}

/// Same as [`check_accessibility_permission`] but with `prompt:true`, which
/// triggers the native macOS "Open System Settings" dialog on the *first*
/// call when the process is not yet trusted. Subsequent calls when the
/// process is still not trusted are rate-limited by the OS (no extra
/// dialogs). Once trusted, both variants simply return `Granted`.
///
/// Use this on an explicit user gesture (e.g. clicking "Grant Accessibility"),
/// and use [`check_accessibility_permission`] for passive status polling so
/// you don't spam the user with dialogs.
pub fn check_accessibility_permission_prompting() -> PermissionState {
    check_accessibility_permission_with_prompt(true)
}

fn check_accessibility_permission_with_prompt(prompt: bool) -> PermissionState {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    // SAFETY: `kAXTrustedCheckOptionPrompt` is a `CFStringRef` constant
    // exported from ApplicationServices.framework, valid for the lifetime of
    // the process. The boolean controls whether the OS raises the native
    // "Open System Settings" dialog when the process is not yet trusted.
    let prompt_key =
        unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
    let value = if prompt {
        CFBoolean::true_value()
    } else {
        CFBoolean::false_value()
    };
    let dict = CFDictionary::from_CFType_pairs(&[(prompt_key, value)]);
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

/// Input Monitoring (`kTCCServiceListenEvent`) status, via the canonical
/// `CGPreflightListenEventAccess` from CoreGraphics. Returns `Granted` when
/// the process is already authorized to install a CGEventTap and `Denied`
/// otherwise. There is no `NotDetermined` once the user has been prompted
/// — same model as Accessibility.
pub fn check_input_monitoring_permission() -> PermissionState {
    // SAFETY: `CGPreflightListenEventAccess` is a thread-safe Core Graphics
    // function with no preconditions; it inspects the process's TCC record.
    let granted = unsafe { CGPreflightListenEventAccess() };
    if granted {
        PermissionState::Granted
    } else {
        PermissionState::Denied
    }
}

/// Kick off the user-facing Input Monitoring authorization request. The OS
/// dialog (and System Settings toggle) appears asynchronously; the actual
/// grant only takes effect after the user toggles the switch and
/// **restarts the app** — TCC does not propagate authorization changes
/// into a running process. The returned `PermissionState` is the
/// *current* preflight value, not a forward-looking one; callers should
/// poll [`check_input_monitoring_permission`] (or, more practically,
/// instruct the user to quit and reopen).
pub fn request_input_monitoring_permission() -> Result<PermissionState, AudioError> {
    // SAFETY: `CGRequestListenEventAccess` is documented to be safe to call
    // at any time; it returns true if the process is already authorized and
    // false otherwise (with a side effect of triggering the request flow).
    let _ = unsafe { CGRequestListenEventAccess() };
    Ok(check_input_monitoring_permission())
}

pub fn open_settings_panel_impl(panel: SettingsPanel) -> Result<(), AudioError> {
    // The enum is exhaustive today, but if a new variant is added without a
    // mapping here we fall back to the root Privacy pane rather than failing
    // the user-facing action.
    let url = match panel {
        SettingsPanel::Microphone => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        SettingsPanel::Accessibility => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        }
        SettingsPanel::InputMonitoring => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
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

// CoreGraphics.framework C symbols for Input Monitoring (CGEventTap clients).
// `CGPreflightListenEventAccess` is a pure status check. `CGRequestListenEventAccess`
// triggers the system's authorization flow; both return `bool` where `true`
// means already-authorized. These symbols live in CoreGraphics, *not*
// ApplicationServices — don't merge with the AX link block.
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}
