use super::{HotkeyCombo, ShortcutError, ShortcutManager};
use std::sync::{Arc, Mutex};

/// Test double for [`ShortcutManager`] used in unit tests across
/// the workspace. `trigger()` simulates the user pressing the
/// configured hotkey so tests can drive downstream behaviour
/// without spawning a real `CGEventTap`.
#[derive(Default, Clone)]
pub struct MockShortcutManager {
    pub registered: Arc<Mutex<Option<HotkeyCombo>>>,
    pub trigger_count: Arc<Mutex<u32>>,
}

impl MockShortcutManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Simulate the user pressing the registered hotkey.
    ///
    /// Pure increment — production wiring would invoke the
    /// configured callback here, but the trait surface in §6.10
    /// keeps callbacks out of the trait itself.
    pub fn trigger(&self) {
        *self.trigger_count.lock().unwrap() += 1;
    }

    pub fn registered(&self) -> Option<HotkeyCombo> {
        self.registered.lock().unwrap().clone()
    }

    pub fn trigger_count(&self) -> u32 {
        *self.trigger_count.lock().unwrap()
    }
}

impl ShortcutManager for MockShortcutManager {
    fn register(&self, combo: HotkeyCombo) -> Result<(), ShortcutError> {
        *self.registered.lock().unwrap() = Some(combo);
        Ok(())
    }

    fn unregister(&self) -> Result<(), ShortcutError> {
        *self.registered.lock().unwrap() = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_records_combo() {
        let m = MockShortcutManager::new();
        m.register(HotkeyCombo::Fn).unwrap();
        assert_eq!(m.registered(), Some(HotkeyCombo::Fn));
    }

    #[test]
    fn register_records_standard_combo() {
        let m = MockShortcutManager::new();
        m.register(HotkeyCombo::Standard {
            combo: "Ctrl+Shift+Space".into(),
        })
        .unwrap();
        assert_eq!(
            m.registered(),
            Some(HotkeyCombo::Standard {
                combo: "Ctrl+Shift+Space".into()
            })
        );
    }

    #[test]
    fn unregister_clears_combo() {
        let m = MockShortcutManager::new();
        m.register(HotkeyCombo::Fn).unwrap();
        m.unregister().unwrap();
        assert_eq!(m.registered(), None);
    }

    #[test]
    fn trigger_increments_count() {
        let m = MockShortcutManager::new();
        m.trigger();
        m.trigger();
        assert_eq!(m.trigger_count(), 2);
    }

    #[test]
    fn mock_implements_send_and_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<MockShortcutManager>();
    }
}
