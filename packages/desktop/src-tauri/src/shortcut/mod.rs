use serde::{Deserialize, Serialize};

pub mod mock;
pub mod standard;

#[cfg(target_os = "macos")]
pub mod macos_fn;

/// Hotkey combination supported by the [`ShortcutManager`] surface.
///
/// `Fn` is macOS-only and routed to a `CGEventTap`-based backend
/// because `tauri-plugin-global-shortcut` cannot observe the
/// secondary-fn modifier on its own. Everything else is a string
/// like `"Ctrl+Shift+Space"` understood by the plugin.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum HotkeyCombo {
    Fn,
    Standard { combo: String },
}

#[derive(Debug, thiserror::Error)]
pub enum ShortcutError {
    #[error("accessibility permission required for Fn-key shortcut")]
    AccessibilityRequired,
    #[error("shortcut backend error: {0}")]
    Backend(String),
}

/// Cross-platform contract for hotkey backends.
///
/// Production wires [`standard::StandardShortcut`] for [`HotkeyCombo::Standard`]
/// and (on macOS) [`macos_fn::MacOsFnTap`] for [`HotkeyCombo::Fn`].
pub trait ShortcutManager: Send + Sync {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError>;
    fn unregister(&self) -> Result<(), ShortcutError>;
}
