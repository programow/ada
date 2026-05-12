//! Platform probes shared across modules.
//!
//! Currently exposes only [`is_wayland_session`] — a Linux-only check that
//! `paste/mod.rs` uses to decide whether to skip the synthetic `Ctrl+V`
//! keystroke, and that the new `get_platform_info` command surfaces to the
//! webview so the onboarding screen can show the appropriate banner.
//!
//! The probe takes an env-getter for testability — production callers use
//! [`is_wayland_session`] which closes over `std::env::var`.

/// Detects whether the current Linux session is running under Wayland.
///
/// Reads `XDG_SESSION_TYPE` first (set by systemd-logind on every modern
/// distro), then falls back to checking whether `WAYLAND_DISPLAY` is set —
/// some sway/Hyprland users leave `XDG_SESSION_TYPE` unset but still have a
/// live Wayland compositor.
pub fn is_wayland_session_with<F>(get_env: F) -> bool
where
    F: Fn(&str) -> Option<String>,
{
    if let Some(session_type) = get_env("XDG_SESSION_TYPE") {
        return session_type.eq_ignore_ascii_case("wayland");
    }
    get_env("WAYLAND_DISPLAY").is_some()
}

/// Production wrapper that closes over `std::env::var`. Always returns
/// `false` on non-Linux platforms — there is no Wayland on macOS/Windows.
#[cfg(target_os = "linux")]
pub fn is_wayland_session() -> bool {
    is_wayland_session_with(|key| std::env::var(key).ok())
}

#[cfg(not(target_os = "linux"))]
pub fn is_wayland_session() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build an env-getter that returns values from a static slice. Lets us
    /// drive `is_wayland_session_with` deterministically without touching the
    /// process-global env (which is racy in parallel tests).
    fn env_from(pairs: &[(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> {
        let owned: Vec<(String, String)> = pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect();
        move |key: &str| owned.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    }

    #[test]
    fn is_wayland_session_returns_true_when_xdg_session_type_is_wayland() {
        let env = env_from(&[("XDG_SESSION_TYPE", "wayland")]);
        assert!(is_wayland_session_with(env));
    }

    #[test]
    fn is_wayland_session_is_case_insensitive_for_xdg_session_type() {
        let env = env_from(&[("XDG_SESSION_TYPE", "Wayland")]);
        assert!(is_wayland_session_with(env));
    }

    #[test]
    fn is_wayland_session_returns_false_for_x11() {
        let env = env_from(&[("XDG_SESSION_TYPE", "x11")]);
        assert!(!is_wayland_session_with(env));
    }

    #[test]
    fn is_wayland_session_falls_back_to_wayland_display_when_xdg_unset() {
        let env = env_from(&[("WAYLAND_DISPLAY", "wayland-0")]);
        assert!(is_wayland_session_with(env));
    }

    #[test]
    fn is_wayland_session_returns_false_when_both_unset() {
        let env = env_from(&[]);
        assert!(!is_wayland_session_with(env));
    }

    #[cfg(not(target_os = "linux"))]
    #[test]
    fn non_linux_is_never_wayland() {
        assert!(!is_wayland_session());
    }
}
