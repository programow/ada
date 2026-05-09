use super::{HotkeyCombo, ShortcutError, ShortcutManager};

/// Wrapper around `tauri-plugin-global-shortcut`.
///
/// This shim is intentionally thin: the real `register` call requires
/// a Tauri `AppHandle`, which lives in the command layer. Section 7
/// only needs the trait wired and the `Fn` rejection branch in place.
#[derive(Default)]
pub struct StandardShortcut;

impl StandardShortcut {
    pub fn new() -> Self {
        Self
    }
}

impl ShortcutManager for StandardShortcut {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError> {
        match combo {
            HotkeyCombo::Fn => Err(ShortcutError::Backend(
                "Fn key not supported by tauri-plugin-global-shortcut; \
                 use macos_fn module on macOS"
                    .into(),
            )),
            HotkeyCombo::Standard { combo: _ } => {
                // Real registration call lives in commands.rs where
                // the AppHandle is available. This shim is a no-op
                // ack so unit tests can validate the trait surface.
                Ok(())
            }
        }
    }

    fn unregister(&self) -> Result<(), ShortcutError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_combo_succeeds() {
        let s = StandardShortcut::new();
        s.register(HotkeyCombo::Standard {
            combo: "Ctrl+Shift+Space".into(),
        })
        .unwrap();
    }

    #[test]
    fn fn_combo_is_rejected() {
        let s = StandardShortcut::new();
        let err = s.register(HotkeyCombo::Fn).unwrap_err();
        let msg = format!("{err}");
        assert!(msg.contains("Fn key not supported"), "got: {msg}");
    }

    #[test]
    fn unregister_is_noop() {
        let s = StandardShortcut::new();
        s.unregister().unwrap();
    }
}
