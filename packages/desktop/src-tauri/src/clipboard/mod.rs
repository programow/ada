use std::sync::Mutex;

use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Trait abstracting clipboard read/write so callers can be tested with an
/// in-memory implementation rather than the real OS clipboard.
pub trait Clipboard: Send + Sync {
    fn write_text(&self, text: &str) -> Result<(), String>;
    fn read_text(&self) -> Result<String, String>;
}

/// Real clipboard backed by the Tauri `tauri-plugin-clipboard-manager` plugin.
pub struct TauriClipboard<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriClipboard<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> Clipboard for TauriClipboard<R> {
    fn write_text(&self, text: &str) -> Result<(), String> {
        self.app
            .clipboard()
            .write_text(text.to_string())
            .map_err(|e| e.to_string())
    }

    fn read_text(&self) -> Result<String, String> {
        self.app.clipboard().read_text().map_err(|e| e.to_string())
    }
}

/// In-memory `Clipboard` for tests.
pub struct InMemoryClipboard {
    inner: Mutex<String>,
}

impl InMemoryClipboard {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(String::new()),
        }
    }
}

impl Default for InMemoryClipboard {
    fn default() -> Self {
        Self::new()
    }
}

impl Clipboard for InMemoryClipboard {
    fn write_text(&self, text: &str) -> Result<(), String> {
        *self.inner.lock().map_err(|e| e.to_string())? = text.to_string();
        Ok(())
    }

    fn read_text(&self) -> Result<String, String> {
        Ok(self.inner.lock().map_err(|e| e.to_string())?.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_then_read_round_trips() {
        let c = InMemoryClipboard::new();
        c.write_text("hello").unwrap();
        assert_eq!(c.read_text().unwrap(), "hello");
    }

    #[test]
    fn defaults_to_empty_string() {
        let c = InMemoryClipboard::new();
        assert_eq!(c.read_text().unwrap(), "");
    }

    #[test]
    fn overwrites_previous_value() {
        let c = InMemoryClipboard::new();
        c.write_text("first").unwrap();
        c.write_text("second").unwrap();
        assert_eq!(c.read_text().unwrap(), "second");
    }

    #[test]
    fn clipboard_trait_is_object_safe() {
        // Verify the trait can be used as a `dyn Clipboard` trait object;
        // callers commonly pass `Arc<dyn Clipboard>` around.
        let boxed: Box<dyn Clipboard> = Box::new(InMemoryClipboard::new());
        boxed.write_text("trait obj").unwrap();
        assert_eq!(boxed.read_text().unwrap(), "trait obj");
    }
}
