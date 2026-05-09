use std::sync::{Arc, Mutex};

use enigo::{Direction, Enigo, Key, Keyboard, Settings};

use crate::clipboard::Clipboard;

/// Trait abstracting "paste text into the active application" so callers can
/// be tested without touching the real OS clipboard or synthesizing keystrokes.
///
/// The contract (per spec §6.10) is: write `text` to the clipboard, then send
/// the platform paste shortcut (Cmd+V on macOS, Ctrl+V elsewhere).
pub trait Paster: Send + Sync {
    fn paste_text(&self, text: &str) -> Result<(), String>;
}

/// Real `Paster` that combines a `Clipboard` write with an `enigo`-driven
/// synthetic paste keystroke.
pub struct EnigoPaster<C: Clipboard> {
    clipboard: Arc<C>,
}

impl<C: Clipboard> EnigoPaster<C> {
    pub fn new(clipboard: Arc<C>) -> Self {
        Self { clipboard }
    }

    /// Send the platform paste keystroke (Cmd+V on macOS, Ctrl+V elsewhere).
    /// Split out so it's swappable and so the clipboard write can be
    /// exercised independently.
    fn send_paste_keystroke(&self) -> Result<(), String> {
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
        let modifier = if cfg!(target_os = "macos") {
            Key::Meta
        } else {
            Key::Control
        };
        enigo
            .key(modifier, Direction::Press)
            .map_err(|e| e.to_string())?;
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| e.to_string())?;
        enigo
            .key(modifier, Direction::Release)
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl<C: Clipboard> Paster for EnigoPaster<C> {
    fn paste_text(&self, text: &str) -> Result<(), String> {
        self.clipboard.write_text(text)?;
        self.send_paste_keystroke()
    }
}

/// Test mock that records every paste request instead of synthesizing
/// keystrokes. The clipboard write is still performed against the supplied
/// `Clipboard` so callers can assert clipboard state and recorded calls
/// independently.
pub struct RecordingPaster<C: Clipboard> {
    clipboard: Arc<C>,
    recorded: Mutex<Vec<String>>,
}

impl<C: Clipboard> RecordingPaster<C> {
    pub fn new(clipboard: Arc<C>) -> Self {
        Self {
            clipboard,
            recorded: Mutex::new(Vec::new()),
        }
    }

    pub fn recorded(&self) -> Vec<String> {
        self.recorded.lock().unwrap().clone()
    }

    pub fn call_count(&self) -> usize {
        self.recorded.lock().unwrap().len()
    }
}

impl<C: Clipboard> Paster for RecordingPaster<C> {
    fn paste_text(&self, text: &str) -> Result<(), String> {
        self.clipboard.write_text(text)?;
        self.recorded
            .lock()
            .map_err(|e| e.to_string())?
            .push(text.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clipboard::InMemoryClipboard;

    #[test]
    fn recording_paster_records_text() {
        let clip = Arc::new(InMemoryClipboard::new());
        let p = RecordingPaster::new(clip.clone());

        p.paste_text("hello world").unwrap();

        assert_eq!(p.recorded(), vec!["hello world".to_string()]);
    }

    #[test]
    fn recording_paster_writes_to_clipboard() {
        let clip = Arc::new(InMemoryClipboard::new());
        let p = RecordingPaster::new(clip.clone());

        p.paste_text("copied").unwrap();

        assert_eq!(clip.read_text().unwrap(), "copied");
    }

    #[test]
    fn recording_paster_counts_multiple_calls() {
        let clip = Arc::new(InMemoryClipboard::new());
        let p = RecordingPaster::new(clip);

        p.paste_text("first").unwrap();
        p.paste_text("second").unwrap();
        p.paste_text("third").unwrap();

        assert_eq!(p.call_count(), 3);
        assert_eq!(
            p.recorded(),
            vec![
                "first".to_string(),
                "second".to_string(),
                "third".to_string()
            ]
        );
    }

    #[test]
    fn paster_trait_is_object_safe() {
        let clip = Arc::new(InMemoryClipboard::new());
        let boxed: Box<dyn Paster> = Box::new(RecordingPaster::new(clip));
        boxed.paste_text("trait obj").unwrap();
    }

    #[test]
    fn last_call_overwrites_clipboard() {
        let clip = Arc::new(InMemoryClipboard::new());
        let p = RecordingPaster::new(clip.clone());

        p.paste_text("first").unwrap();
        p.paste_text("second").unwrap();

        assert_eq!(clip.read_text().unwrap(), "second");
    }
}
