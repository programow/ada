# Recording Settings & Transcription History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `Settings → Recording` (hotkey + mic picker), `Settings → History` (retention + Clear all), `History` tab (per-row delete with undo + export), and `Dashboard` (5 stats cards) end-to-end. Replace the dead Rust `history/{repo,retention,stats}.rs` modules with JS-side equivalents in `lib/db.ts`.

**Architecture:** Persistence in the existing `app_state` key-value table. Two new Tauri commands (`list_audio_input_devices`, `register_hotkey`) plus one modified (`start_recording` accepts an optional `device_id`). Daily retention sweep runs in the React app via `setTimeout`. Export uses client-side `Blob` + browser download.

**Tech Stack:** Rust (`cpal`, `tauri-plugin-global-shortcut`), TypeScript (`tauri-plugin-sql`, React 18, Vitest, happy-dom), conventional commits via Lefthook + commitlint.

**Spec:** `docs/superpowers/specs/2026-05-10-recording-settings-and-history-design.md`

---

## Section 1: Rust — shortcut parser + Tauri commands

### Task 1: Combo string parser (`shortcut/parse.rs`)

**Files:**
- Create: `packages/desktop/src-tauri/src/shortcut/parse.rs`
- Modify: `packages/desktop/src-tauri/src/shortcut/mod.rs` (add `pub mod parse;`)

- [ ] **Step 1: Add module declaration**

In `packages/desktop/src-tauri/src/shortcut/mod.rs`, add at the top alongside the other `pub mod` lines:

```rust
pub mod parse;
```

- [ ] **Step 2: Write failing tests**

Create `packages/desktop/src-tauri/src/shortcut/parse.rs` with this content:

```rust
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ParseError {
    #[error("combo is empty")]
    Empty,
    #[error("combo has no modifier (need at least one of Cmd, Ctrl, Alt, Shift)")]
    NoModifier,
    #[error("combo has no key (need a non-modifier key like Space or A)")]
    NoKey,
    #[error("unknown key: {0}")]
    UnknownKey(String),
}

pub fn parse_combo(_input: &str) -> Result<Shortcut, ParseError> {
    todo!()
}

pub fn format_combo(_shortcut: &Shortcut) -> String {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rejects_empty() {
        assert_eq!(parse_combo(""), Err(ParseError::Empty));
        assert_eq!(parse_combo("   "), Err(ParseError::Empty));
    }

    #[test]
    fn parse_rejects_modifier_only() {
        assert_eq!(parse_combo("Cmd"), Err(ParseError::NoKey));
        assert_eq!(parse_combo("Cmd+Shift"), Err(ParseError::NoKey));
    }

    #[test]
    fn parse_rejects_key_only() {
        assert_eq!(parse_combo("Space"), Err(ParseError::NoModifier));
        assert_eq!(parse_combo("A"), Err(ParseError::NoModifier));
    }

    #[test]
    fn parse_rejects_unknown_key() {
        assert!(matches!(
            parse_combo("Cmd+Foobar"),
            Err(ParseError::UnknownKey(_))
        ));
    }

    #[test]
    fn parse_accepts_cmd_shift_space() {
        let s = parse_combo("Cmd+Shift+Space").unwrap();
        assert_eq!(s.mods, Modifiers::META | Modifiers::SHIFT);
        assert_eq!(s.key, Code::Space);
    }

    #[test]
    fn parse_accepts_ctrl_shift_space() {
        let s = parse_combo("Ctrl+Shift+Space").unwrap();
        assert_eq!(s.mods, Modifiers::CONTROL | Modifiers::SHIFT);
        assert_eq!(s.key, Code::Space);
    }

    #[test]
    fn parse_is_case_insensitive_for_modifiers() {
        let a = parse_combo("cmd+shift+space").unwrap();
        let b = parse_combo("CMD+SHIFT+SPACE").unwrap();
        assert_eq!(a.mods, b.mods);
        assert_eq!(a.key, b.key);
    }

    #[test]
    fn parse_alt_option_alias() {
        let a = parse_combo("Alt+A").unwrap();
        let b = parse_combo("Option+A").unwrap();
        assert_eq!(a.mods, b.mods);
        assert_eq!(a.mods, Modifiers::ALT);
    }

    #[test]
    fn parse_function_keys() {
        assert_eq!(parse_combo("Cmd+F1").unwrap().key, Code::F1);
        assert_eq!(parse_combo("Cmd+F12").unwrap().key, Code::F12);
    }

    #[test]
    fn parse_arrows() {
        assert_eq!(parse_combo("Cmd+Up").unwrap().key, Code::ArrowUp);
        assert_eq!(parse_combo("Cmd+Down").unwrap().key, Code::ArrowDown);
        assert_eq!(parse_combo("Cmd+Left").unwrap().key, Code::ArrowLeft);
        assert_eq!(parse_combo("Cmd+Right").unwrap().key, Code::ArrowRight);
    }

    #[test]
    fn format_roundtrip() {
        for input in ["Cmd+Shift+Space", "Ctrl+Alt+A", "Cmd+F5", "Shift+Tab"] {
            let parsed = parse_combo(input).unwrap();
            let formatted = format_combo(&parsed);
            let reparsed = parse_combo(&formatted).unwrap();
            assert_eq!(
                parsed.mods, reparsed.mods,
                "mods drift on input {input}: got {formatted}"
            );
            assert_eq!(
                parsed.key, reparsed.key,
                "key drift on input {input}: got {formatted}"
            );
        }
    }

    #[test]
    fn format_uses_stable_modifier_order() {
        let s = parse_combo("Shift+Cmd+Alt+Ctrl+A").unwrap();
        let formatted = format_combo(&s);
        assert_eq!(formatted, "Cmd+Ctrl+Alt+Shift+A");
    }
}
```

- [ ] **Step 3: Run the tests, confirm they fail**

Run: `cd packages/desktop/src-tauri && cargo test --lib shortcut::parse`
Expected: FAIL with `not yet implemented` panics on `parse_combo` and `format_combo`.

- [ ] **Step 4: Implement**

Replace `parse_combo` and `format_combo` (and add the helper) with:

```rust
pub fn parse_combo(input: &str) -> Result<Shortcut, ParseError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(ParseError::Empty);
    }
    let mut mods = Modifiers::empty();
    let mut key: Option<Code> = None;
    for raw in trimmed.split('+') {
        let part = raw.trim();
        if part.is_empty() {
            continue;
        }
        match part.to_ascii_lowercase().as_str() {
            "cmd" | "command" | "meta" | "super" | "win" | "windows" => {
                mods |= Modifiers::META;
            }
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "alt" | "option" | "opt" => mods |= Modifiers::ALT,
            "shift" => mods |= Modifiers::SHIFT,
            other => {
                if key.is_some() {
                    return Err(ParseError::UnknownKey(other.to_string()));
                }
                key = Some(parse_key(other).ok_or_else(|| {
                    ParseError::UnknownKey(other.to_string())
                })?);
            }
        }
    }
    let Some(k) = key else {
        if mods.is_empty() {
            return Err(ParseError::NoModifier);
        }
        return Err(ParseError::NoKey);
    };
    if mods.is_empty() {
        return Err(ParseError::NoModifier);
    }
    Ok(Shortcut::new(Some(mods), k))
}

pub fn format_combo(shortcut: &Shortcut) -> String {
    let mut parts: Vec<&str> = Vec::with_capacity(5);
    if shortcut.mods.contains(Modifiers::META) {
        parts.push("Cmd");
    }
    if shortcut.mods.contains(Modifiers::CONTROL) {
        parts.push("Ctrl");
    }
    if shortcut.mods.contains(Modifiers::ALT) {
        parts.push("Alt");
    }
    if shortcut.mods.contains(Modifiers::SHIFT) {
        parts.push("Shift");
    }
    let mut out = parts.join("+");
    if !out.is_empty() {
        out.push('+');
    }
    out.push_str(&format_key(shortcut.key));
    out
}

fn parse_key(s: &str) -> Option<Code> {
    let upper = s.to_ascii_uppercase();
    if upper.len() == 1 {
        let c = upper.chars().next()?;
        if c.is_ascii_alphabetic() {
            return Some(letter_code(c));
        }
        if c.is_ascii_digit() {
            return Some(digit_code(c));
        }
    }
    match upper.as_str() {
        "SPACE" => Some(Code::Space),
        "ENTER" | "RETURN" => Some(Code::Enter),
        "ESC" | "ESCAPE" => Some(Code::Escape),
        "TAB" => Some(Code::Tab),
        "BACKSPACE" => Some(Code::Backspace),
        "DELETE" | "DEL" => Some(Code::Delete),
        "UP" | "ARROWUP" => Some(Code::ArrowUp),
        "DOWN" | "ARROWDOWN" => Some(Code::ArrowDown),
        "LEFT" | "ARROWLEFT" => Some(Code::ArrowLeft),
        "RIGHT" | "ARROWRIGHT" => Some(Code::ArrowRight),
        "F1" => Some(Code::F1),
        "F2" => Some(Code::F2),
        "F3" => Some(Code::F3),
        "F4" => Some(Code::F4),
        "F5" => Some(Code::F5),
        "F6" => Some(Code::F6),
        "F7" => Some(Code::F7),
        "F8" => Some(Code::F8),
        "F9" => Some(Code::F9),
        "F10" => Some(Code::F10),
        "F11" => Some(Code::F11),
        "F12" => Some(Code::F12),
        _ => None,
    }
}

fn letter_code(c: char) -> Code {
    match c {
        'A' => Code::KeyA, 'B' => Code::KeyB, 'C' => Code::KeyC, 'D' => Code::KeyD,
        'E' => Code::KeyE, 'F' => Code::KeyF, 'G' => Code::KeyG, 'H' => Code::KeyH,
        'I' => Code::KeyI, 'J' => Code::KeyJ, 'K' => Code::KeyK, 'L' => Code::KeyL,
        'M' => Code::KeyM, 'N' => Code::KeyN, 'O' => Code::KeyO, 'P' => Code::KeyP,
        'Q' => Code::KeyQ, 'R' => Code::KeyR, 'S' => Code::KeyS, 'T' => Code::KeyT,
        'U' => Code::KeyU, 'V' => Code::KeyV, 'W' => Code::KeyW, 'X' => Code::KeyX,
        'Y' => Code::KeyY, 'Z' => Code::KeyZ,
        _ => unreachable!("letter_code called with non-letter {c}"),
    }
}

fn digit_code(c: char) -> Code {
    match c {
        '0' => Code::Digit0, '1' => Code::Digit1, '2' => Code::Digit2, '3' => Code::Digit3,
        '4' => Code::Digit4, '5' => Code::Digit5, '6' => Code::Digit6, '7' => Code::Digit7,
        '8' => Code::Digit8, '9' => Code::Digit9,
        _ => unreachable!("digit_code called with non-digit {c}"),
    }
}

fn format_key(code: Code) -> String {
    use Code::*;
    let s = match code {
        KeyA => "A", KeyB => "B", KeyC => "C", KeyD => "D", KeyE => "E",
        KeyF => "F", KeyG => "G", KeyH => "H", KeyI => "I", KeyJ => "J",
        KeyK => "K", KeyL => "L", KeyM => "M", KeyN => "N", KeyO => "O",
        KeyP => "P", KeyQ => "Q", KeyR => "R", KeyS => "S", KeyT => "T",
        KeyU => "U", KeyV => "V", KeyW => "W", KeyX => "X", KeyY => "Y", KeyZ => "Z",
        Digit0 => "0", Digit1 => "1", Digit2 => "2", Digit3 => "3", Digit4 => "4",
        Digit5 => "5", Digit6 => "6", Digit7 => "7", Digit8 => "8", Digit9 => "9",
        Space => "Space", Enter => "Enter", Escape => "Escape", Tab => "Tab",
        Backspace => "Backspace", Delete => "Delete",
        ArrowUp => "Up", ArrowDown => "Down", ArrowLeft => "Left", ArrowRight => "Right",
        F1 => "F1", F2 => "F2", F3 => "F3", F4 => "F4", F5 => "F5", F6 => "F6",
        F7 => "F7", F8 => "F8", F9 => "F9", F10 => "F10", F11 => "F11", F12 => "F12",
        other => return format!("{other:?}"),
    };
    s.to_string()
}
```

- [ ] **Step 5: Run the tests, confirm pass**

Run: `cargo test --lib shortcut::parse`
Expected: 11 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src-tauri/src/shortcut/
git commit -m "feat(desktop): add hotkey combo string parser/formatter"
```

---

### Task 2: `list_audio_input_devices` Tauri command

**Files:**
- Modify: `packages/desktop/src-tauri/src/audio/microphone.rs` (add `list_devices()` helper)
- Modify: `packages/desktop/src-tauri/src/commands.rs` (new command + struct)
- Modify: `packages/desktop/src-tauri/src/lib.rs` (register handler)

- [ ] **Step 1: Add a failing test for the device-listing helper**

Append to the bottom of `packages/desktop/src-tauri/src/audio/microphone.rs` inside the existing `mod tests` block:

```rust
#[test]
fn list_devices_returns_at_least_one_entry_or_empty_vec() {
    // CI runners always have at least the system default; locally devices
    // come and go. Just assert the call doesn't panic and returns something
    // serializable.
    let result = MicrophoneSource::list_devices();
    assert!(result.is_ok(), "list_devices should not error: {result:?}");
}
```

- [ ] **Step 2: Run, confirm fail**

Run: `cargo test --lib audio::microphone::tests::list_devices`
Expected: FAIL — `MicrophoneSource::list_devices` does not exist.

- [ ] **Step 3: Implement the helper**

Add to the `impl MicrophoneSource` block in `microphone.rs`:

```rust
impl MicrophoneSource {
    pub fn list_devices() -> Result<Vec<crate::audio::AudioDeviceInfo>, AudioError> {
        use cpal::traits::{DeviceTrait, HostTrait};
        let host = cpal::default_host();
        let default_name = host
            .default_input_device()
            .and_then(|d| d.name().ok());
        let devices = host
            .input_devices()
            .map_err(|e| AudioError::DeviceUnavailable(e.to_string()))?;
        let mut out = Vec::new();
        for d in devices {
            if let Ok(name) = d.name() {
                let is_default = default_name.as_deref() == Some(name.as_str());
                out.push(crate::audio::AudioDeviceInfo {
                    id: name.clone(),
                    label: name,
                    is_default,
                });
            }
        }
        Ok(out)
    }
}
```

Add the `AudioDeviceInfo` type to `packages/desktop/src-tauri/src/audio/mod.rs` (alongside `PermissionState`):

```rust
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub id: String,
    pub label: String,
    pub is_default: bool,
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cargo test --lib audio::microphone::tests::list_devices`
Expected: 1 test passes.

- [ ] **Step 5: Add Tauri command**

Append to `packages/desktop/src-tauri/src/commands.rs`:

```rust
use crate::audio::{AudioDeviceInfo, microphone::MicrophoneSource};

#[tauri::command]
pub fn list_audio_input_devices() -> Vec<AudioDeviceInfo> {
    MicrophoneSource::list_devices().unwrap_or_default()
}
```

- [ ] **Step 6: Register the handler**

In `packages/desktop/src-tauri/src/lib.rs`, add to the `tauri::generate_handler![...]` list (alphabetical-ish, after `delete_secret`):

```rust
            commands::list_audio_input_devices,
```

- [ ] **Step 7: Verify build**

Run: `cargo check`
Expected: clean compile.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/ packages/desktop/src-tauri/src/commands.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add list_audio_input_devices Tauri command"
```

---

### Task 3: `start_recording` accepts optional `device_id`

**Files:**
- Modify: `packages/desktop/src-tauri/src/audio/mod.rs` (extend `AudioSource` trait)
- Modify: `packages/desktop/src-tauri/src/audio/microphone.rs`
- Modify: `packages/desktop/src-tauri/src/audio/mock.rs`
- Modify: `packages/desktop/src-tauri/src/commands.rs`

- [ ] **Step 1: Add a failing test for the device-aware start path**

Append to the existing `audio::mock::tests` block in `packages/desktop/src-tauri/src/audio/mock.rs`:

```rust
#[test]
fn start_capture_with_device_routes_to_default_when_none() {
    let m = MockMicrophoneSource::granted_with_bytes(b"abc".to_vec());
    let s = m.start_capture_with_device(None).unwrap();
    let bytes = m.stop_capture(&s).unwrap();
    assert_eq!(bytes, b"abc");
}

#[test]
fn start_capture_with_device_records_requested_id() {
    let m = MockMicrophoneSource::granted_with_bytes(b"abc".to_vec());
    let _ = m.start_capture_with_device(Some("USB Mic")).unwrap();
    assert_eq!(m.last_requested_device_id(), Some("USB Mic".to_string()));
}
```

- [ ] **Step 2: Run, confirm fail**

Run: `cargo test --lib audio::mock`
Expected: FAIL — method does not exist.

- [ ] **Step 3: Extend the trait**

In `packages/desktop/src-tauri/src/audio/mod.rs`, change the `AudioSource` trait from:

```rust
pub trait AudioSource: Send + Sync {
    fn check_permission(&self) -> PermissionState;
    fn request_permission(&self) -> Result<PermissionState, AudioError>;
    fn start_capture(&self) -> Result<CaptureSession, AudioError>;
    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError>;
}
```

to:

```rust
pub trait AudioSource: Send + Sync {
    fn check_permission(&self) -> PermissionState;
    fn request_permission(&self) -> Result<PermissionState, AudioError>;
    fn start_capture(&self) -> Result<CaptureSession, AudioError> {
        self.start_capture_with_device(None)
    }
    fn start_capture_with_device(
        &self,
        device_id: Option<&str>,
    ) -> Result<CaptureSession, AudioError>;
    fn stop_capture(&self, session: &CaptureSession) -> Result<Vec<u8>, AudioError>;
}
```

- [ ] **Step 4: Update `MicrophoneSource`**

In `microphone.rs`, change the `impl AudioSource for MicrophoneSource` block:

Replace `fn start_capture(&self) -> Result<CaptureSession, AudioError> { ... existing body ... }` with `fn start_capture_with_device(&self, device_id: Option<&str>) -> Result<CaptureSession, AudioError> { ... }`. Move the existing body's device-acquisition step from `host.default_input_device()` to a function that, when `device_id` is `Some(name)`, iterates `host.input_devices()?` and finds the matching one. If no match: return `Err(AudioError::DeviceUnavailable(name.to_string()))`. Otherwise fall through to the default.

Concrete patch (the device-acquisition fragment within the existing function):

```rust
let device = match device_id {
    None => cpal::default_host()
        .default_input_device()
        .ok_or_else(|| AudioError::DeviceUnavailable("system default".to_string()))?,
    Some(name) => {
        use cpal::traits::{DeviceTrait, HostTrait};
        let host = cpal::default_host();
        host.input_devices()
            .map_err(|e| AudioError::DeviceUnavailable(e.to_string()))?
            .find(|d| d.name().map(|n| n == name).unwrap_or(false))
            .ok_or_else(|| AudioError::DeviceUnavailable(name.to_string()))?
    }
};
```

- [ ] **Step 5: Update `MockMicrophoneSource`**

In `mock.rs`, change the trait impl. Add a `last_device: Mutex<Option<String>>` field. Replace the `start_capture` impl with `start_capture_with_device`:

```rust
fn start_capture_with_device(
    &self,
    device_id: Option<&str>,
) -> Result<CaptureSession, AudioError> {
    *self.last_device.lock().unwrap() = device_id.map(str::to_string);
    // existing permission-and-id logic here
}
```

Add a public accessor:

```rust
impl MockMicrophoneSource {
    pub fn last_requested_device_id(&self) -> Option<String> {
        self.last_device.lock().unwrap().clone()
    }
}
```

- [ ] **Step 6: Update the Tauri command in `commands.rs`**

Replace the existing `start_recording` command with:

```rust
#[tauri::command]
pub fn start_recording(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<String, String> {
    let session = state
        .audio
        .start_capture_with_device(device_id.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(session.id.to_string())
}
```

- [ ] **Step 7: Run all audio tests**

Run: `cargo test --lib audio`
Expected: all tests pass (no regressions; new mock tests green).

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src-tauri/src/audio/ packages/desktop/src-tauri/src/commands.rs
git commit -m "feat(desktop): start_recording accepts optional device_id"
```

---

### Task 4: `register_hotkey` / `unregister_hotkey` commands + dynamic registration in setup

**Files:**
- Modify: `packages/desktop/src-tauri/src/commands.rs` (add commands, extend `AppState`)
- Modify: `packages/desktop/src-tauri/src/lib.rs` (initialize `current_hotkey`, register on startup)

- [ ] **Step 1: Extend `AppState` with a mutable current-hotkey slot**

In `commands.rs`, change:

```rust
pub struct AppState {
    pub audio: Box<dyn AudioSource>,
    pub vault: Box<dyn Vault>,
    pub paster: Box<dyn Paster>,
}
```

to:

```rust
use std::sync::Mutex;
use tauri_plugin_global_shortcut::Shortcut;

pub struct AppState {
    pub audio: Box<dyn AudioSource>,
    pub vault: Box<dyn Vault>,
    pub paster: Box<dyn Paster>,
    pub current_hotkey: Mutex<Option<Shortcut>>,
}
```

- [ ] **Step 2: Add the commands**

Append to `commands.rs`:

```rust
use crate::shortcut::parse::{format_combo, parse_combo};
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
pub fn register_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
    combo: String,
) -> Result<String, String> {
    let shortcut = parse_combo(&combo).map_err(|e| e.to_string())?;
    let mut current = state.current_hotkey.lock().map_err(|e| e.to_string())?;
    if let Some(prev) = current.take() {
        let _ = app.global_shortcut().unregister(prev);
    }
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_, _, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app_clone.emit("vox-era://shortcut-toggle", ());
            }
        })
        .map_err(|e| e.to_string())?;
    *current = Some(shortcut);
    Ok(format_combo(&shortcut))
}

#[tauri::command]
pub fn unregister_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut current = state.current_hotkey.lock().map_err(|e| e.to_string())?;
    if let Some(prev) = current.take() {
        app.global_shortcut()
            .unregister(prev)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

- [ ] **Step 3: Replace the hardcoded `on_shortcut` in `lib.rs` setup**

In `lib.rs`, the existing setup block has:

```rust
let shortcut = default_record_shortcut();
app.global_shortcut().on_shortcut(shortcut, |app, _, event| {
    if event.state() == ShortcutState::Pressed {
        let _ = app.emit("vox-era://shortcut-toggle", ());
    }
})?;
```

Replace with a registration via the `register_hotkey` path:

1. Change the AppState construction in setup so the snippet `let app_state = AppState { audio: ..., vault: ..., paster: ..., }` becomes:

```rust
let app_state = AppState {
    audio: Box::new(MicrophoneSource::new()),
    vault: Box::new(KeyringVault::new()),
    paster: Box::new(EnigoPaster::new(clipboard)),
    current_hotkey: std::sync::Mutex::new(None),
};
```

2. **Delete** the entire block in setup that calls `app.global_shortcut().on_shortcut(default_record_shortcut(), ...)`. The JS side will call `register_hotkey` on app start with the persisted combo (or the platform default surfaced by `getHotkeyCombo` in `lib/db.ts`).

3. **Delete** the `fn default_record_shortcut()` definition above `pub fn run()` — unused after step 2.

4. Remove now-unused imports: `Code`, `Modifiers`, `Shortcut` (the `tauri_plugin_global_shortcut::{...}` import line). Keep `GlobalShortcutExt` and `ShortcutState` only if any remaining code uses them; otherwise remove that whole `use` line and let the new commands.rs imports cover them.

- [ ] **Step 4: Register the new commands**

Add to `tauri::generate_handler![...]` in `lib.rs`:

```rust
            commands::register_hotkey,
            commands::unregister_hotkey,
```

- [ ] **Step 5: Verify build**

Run: `cargo check` then `cargo test --lib`
Expected: clean compile, all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/desktop/src-tauri/src/
git commit -m "feat(desktop): dynamic hotkey registration via register_hotkey command"
```

---

## Section 2: TypeScript — invoke wrapper + db helpers

### Task 5: Update typed `vox.*` invoke wrapper

**Files:**
- Modify: `packages/desktop/src/lib/invoke.ts`
- Modify: `packages/desktop/src/lib/invoke.test.ts`

- [ ] **Step 1: Write failing tests for the new wrappers**

Append to `packages/desktop/src/lib/invoke.test.ts`:

```ts
describe('vox.listAudioInputDevices', () => {
    it('invokes list_audio_input_devices with no args', async () => {
        const invoke = vi.mocked(coreInvoke);
        invoke.mockResolvedValueOnce([
            { id: 'a', label: 'A', isDefault: true },
        ]);
        const result = await vox.listAudioInputDevices();
        expect(invoke).toHaveBeenCalledWith('list_audio_input_devices');
        expect(result).toEqual([{ id: 'a', label: 'A', isDefault: true }]);
    });
});

describe('vox.startRecording', () => {
    it('passes the device id when supplied', async () => {
        const invoke = vi.mocked(coreInvoke);
        invoke.mockResolvedValueOnce('session-1');
        await vox.startRecording('USB Mic');
        expect(invoke).toHaveBeenCalledWith('start_recording', {
            deviceId: 'USB Mic',
        });
    });
    it('passes undefined deviceId when omitted', async () => {
        const invoke = vi.mocked(coreInvoke);
        invoke.mockResolvedValueOnce('session-2');
        await vox.startRecording();
        expect(invoke).toHaveBeenCalledWith('start_recording', {
            deviceId: undefined,
        });
    });
});

describe('vox.registerHotkey', () => {
    it('passes the combo string', async () => {
        const invoke = vi.mocked(coreInvoke);
        invoke.mockResolvedValueOnce('Cmd+Shift+Space');
        const formatted = await vox.registerHotkey('cmd+shift+space');
        expect(invoke).toHaveBeenCalledWith('register_hotkey', {
            combo: 'cmd+shift+space',
        });
        expect(formatted).toBe('Cmd+Shift+Space');
    });
});
```

(Use whatever import alias the existing test file uses for `coreInvoke`. If imports differ, add `import { invoke as coreInvoke } from '@tauri-apps/api/core';` and `vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));` if not already present.)

- [ ] **Step 2: Run, confirm fail**

Run: `cd packages/desktop && bun run test:unit -- src/lib/invoke.test.ts`
Expected: FAIL on the new methods.

- [ ] **Step 3: Update `invoke.ts`**

Replace the `vox` object with:

```ts
import { invoke } from '@tauri-apps/api/core';

export type PermissionState = 'Granted' | 'Denied' | 'NotDetermined';

export interface AudioDeviceInfo {
    id: string;
    label: string;
    isDefault: boolean;
}

export const vox = {
    checkMicrophonePermission: () =>
        invoke<PermissionState>('check_microphone_permission'),
    requestMicrophonePermission: () =>
        invoke<PermissionState>('request_microphone_permission'),
    checkAccessibilityPermission: () =>
        invoke<PermissionState>('check_accessibility_permission'),
    requestAccessibilityPermission: () =>
        invoke<void>('request_accessibility_permission'),
    openSettingsPanel: (panel: 'microphone' | 'accessibility') =>
        invoke<void>('open_settings_panel', { panel }),

    listAudioInputDevices: () =>
        invoke<AudioDeviceInfo[]>('list_audio_input_devices'),
    startRecording: (deviceId?: string) =>
        invoke<string>('start_recording', { deviceId }),
    stopRecording: (sessionId: string) =>
        invoke<number[]>('stop_recording', { sessionId }),

    registerHotkey: (combo: string) =>
        invoke<string>('register_hotkey', { combo }),
    unregisterHotkey: () => invoke<void>('unregister_hotkey'),

    getSecret: (secretId: string) =>
        invoke<string | null>('get_secret', { secretId }),
    setSecret: (secretId: string, key: string) =>
        invoke<void>('set_secret', { secretId, key }),
    deleteSecret: (secretId: string) =>
        invoke<void>('delete_secret', { secretId }),

    pasteText: (text: string) => invoke<void>('paste_text', { text }),
};
```

- [ ] **Step 4: Run, confirm pass**

Run: `bun run test:unit -- src/lib/invoke.test.ts`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/lib/invoke.ts packages/desktop/src/lib/invoke.test.ts
git commit -m "feat(desktop): typed wrappers for new audio + hotkey commands"
```

---

### Task 6: `app_state` helpers in `lib/db.ts` for mic + hotkey

**Files:**
- Modify: `packages/desktop/src/lib/db.ts`
- Modify: `packages/desktop/src/lib/db.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/desktop/src/lib/db.test.ts` (in a new `describe` block):

```ts
describe('db.selectedMicDeviceId', () => {
    it('returns null when not set', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getSelectedMicDeviceId()).resolves.toBeNull();
    });
    it('returns the persisted value', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'USB Mic' }]);
        await expect(getSelectedMicDeviceId()).resolves.toBe('USB Mic');
    });
    it('persists null by deleting the row', async () => {
        await setSelectedMicDeviceId(null);
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /DELETE FROM app_state/i.test(s))).toBe(true);
    });
    it('persists a value via upsert', async () => {
        await setSelectedMicDeviceId('USB Mic');
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /INSERT INTO app_state/i.test(s))).toBe(true);
    });
});

describe('db.hotkeyCombo', () => {
    it('returns the platform default when not set', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        const combo = await getHotkeyCombo();
        expect(combo === 'Cmd+Shift+Space' || combo === 'Ctrl+Shift+Space').toBe(true);
    });
    it('returns the persisted combo', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'Cmd+Alt+R' }]);
        await expect(getHotkeyCombo()).resolves.toBe('Cmd+Alt+R');
    });
    it('persists via upsert', async () => {
        await setHotkeyCombo('Cmd+Alt+R');
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /INSERT INTO app_state/i.test(s))).toBe(true);
    });
});
```

Update the imports at the top of the test file to include the four new functions (`getSelectedMicDeviceId`, `setSelectedMicDeviceId`, `getHotkeyCombo`, `setHotkeyCombo`).

- [ ] **Step 2: Run, confirm fail**

Run: `bun run test:unit -- src/lib/db.test.ts`
Expected: FAIL — functions don't exist.

- [ ] **Step 3: Implement**

At the top of `packages/desktop/src/lib/db.ts`, add the new keys near the existing constants:

```ts
const SELECTED_MIC_DEVICE_KEY = 'selected_mic_device_id';
const HOTKEY_COMBO_KEY = 'hotkey_combo';
```

At the bottom of the file (alongside the other `app_state` accessors), add:

```ts
export async function getSelectedMicDeviceId(): Promise<string | null> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        SELECTED_MIC_DEVICE_KEY,
    ])) as { value: string }[];
    return rows[0]?.value ?? null;
}

export async function setSelectedMicDeviceId(id: string | null): Promise<void> {
    const conn = await db();
    if (id === null) {
        await conn.execute('DELETE FROM app_state WHERE key = ?', [
            SELECTED_MIC_DEVICE_KEY,
        ]);
        return;
    }
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [SELECTED_MIC_DEVICE_KEY, id],
    );
}

function defaultHotkeyCombo(): string {
    // Detect macOS without DOM (in tests we are happy-dom; this branch is taken).
    const isMac =
        typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
    return isMac ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
}

export async function getHotkeyCombo(): Promise<string> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        HOTKEY_COMBO_KEY,
    ])) as { value: string }[];
    return rows[0]?.value ?? defaultHotkeyCombo();
}

export async function setHotkeyCombo(combo: string): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [HOTKEY_COMBO_KEY, combo],
    );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `bun run test:unit -- src/lib/db.test.ts`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/lib/db.ts packages/desktop/src/lib/db.test.ts
git commit -m "feat(desktop): persist mic device + hotkey combo in app_state"
```

---

## Section 3: Recording UI

### Task 7: `HotkeyInput` component

**Files:**
- Create: `packages/desktop/src/components/HotkeyInput.tsx`
- Create: `packages/desktop/src/components/HotkeyInput.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `HotkeyInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HotkeyInput } from './HotkeyInput';

describe('HotkeyInput', () => {
    it('renders the current combo when idle', () => {
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={() => {}} />);
        expect(screen.getByText('Cmd+Shift+Space')).toBeInTheDocument();
    });

    it('captures a combo when the user clicks Capture and presses keys', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        // simulate Shift+A
        act(() => {
            window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'A', code: 'KeyA', shiftKey: true }),
            );
        });
        expect(onChange).toHaveBeenCalledWith('Shift+A');
    });

    it('ignores modifier-only key events while capturing', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft' }));
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('Esc cancels capture without firing onChange', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText('Cmd+Shift+Space')).toBeInTheDocument();
    });

    it('refuses combos with no modifier', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', code: 'KeyA' }));
        });
        expect(onChange).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `bun run test:unit -- src/components/HotkeyInput.test.tsx`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

Create `HotkeyInput.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export interface HotkeyInputProps {
    value: string;
    onChange: (combo: string) => void;
}

function formatFromEvent(e: KeyboardEvent): string | null {
    if (e.key === 'Escape') return null;
    const isModifierKey =
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta' ||
        e.key === 'OS';
    if (isModifierKey) return null;
    const parts: string[] = [];
    if (e.metaKey) parts.push('Cmd');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (parts.length === 0) return null;
    parts.push(keyLabel(e));
    return parts.join('+');
}

function keyLabel(e: KeyboardEvent): string {
    if (e.code.startsWith('Key')) return e.code.slice(3);
    if (e.code.startsWith('Digit')) return e.code.slice(5);
    if (e.code.startsWith('Arrow')) return e.code.slice(5);
    if (e.code === 'Space') return 'Space';
    if (e.code === 'Enter') return 'Enter';
    if (e.code === 'Escape') return 'Escape';
    if (e.code === 'Tab') return 'Tab';
    if (e.code === 'Backspace') return 'Backspace';
    if (e.code === 'Delete') return 'Delete';
    if (/^F\d{1,2}$/.test(e.code)) return e.code;
    return e.key.toUpperCase();
}

export function HotkeyInput({ value, onChange }: HotkeyInputProps) {
    const [capturing, setCapturing] = useState(false);

    useEffect(() => {
        if (!capturing) return;
        function handle(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setCapturing(false);
                return;
            }
            const combo = formatFromEvent(e);
            if (combo === null) return;
            onChange(combo);
            setCapturing(false);
        }
        window.addEventListener('keydown', handle, true);
        return () => window.removeEventListener('keydown', handle, true);
    }, [capturing, onChange]);

    return (
        <div className="flex items-center gap-2">
            <span
                data-testid="hotkey-display"
                className="inline-flex h-10 min-w-[12rem] items-center border-3 border-border bg-bg px-3 text-sm font-bold uppercase tracking-widest shadow-neo"
            >
                {capturing ? 'Press a key combo…' : value}
            </span>
            <Button onClick={() => setCapturing((v) => !v)}>
                {capturing ? 'Cancel' : 'Capture…'}
            </Button>
        </div>
    );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `bun run test:unit -- src/components/HotkeyInput.test.tsx`
Expected: green (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/components/HotkeyInput.tsx packages/desktop/src/components/HotkeyInput.test.tsx
git commit -m "feat(desktop): add HotkeyInput capture component"
```

---

### Task 8: Rewrite `SettingsRecording.tsx` with real wiring

**Files:**
- Modify: `packages/desktop/src/windows/main/SettingsRecording.tsx`
- Modify: `packages/desktop/src/windows/main/SettingsRecording.test.tsx`

- [ ] **Step 1: Update tests**

Replace the existing `SettingsRecording.test.tsx` body with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsRecording } from './SettingsRecording';

vi.mock('@/lib/invoke', () => ({
    vox: {
        listAudioInputDevices: vi.fn(),
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        registerHotkey: vi.fn(),
    },
}));
vi.mock('@/lib/db', () => ({
    getSelectedMicDeviceId: vi.fn(),
    setSelectedMicDeviceId: vi.fn(),
    getHotkeyCombo: vi.fn(),
    setHotkeyCombo: vi.fn(),
}));

import { vox } from '@/lib/invoke';
import {
    getHotkeyCombo,
    getSelectedMicDeviceId,
    setHotkeyCombo,
    setSelectedMicDeviceId,
} from '@/lib/db';

const voxMock = vi.mocked(vox);
const getSelectedMicDeviceIdMock = vi.mocked(getSelectedMicDeviceId);
const setSelectedMicDeviceIdMock = vi.mocked(setSelectedMicDeviceId);
const getHotkeyComboMock = vi.mocked(getHotkeyCombo);
const setHotkeyComboMock = vi.mocked(setHotkeyCombo);

beforeEach(() => {
    voxMock.listAudioInputDevices.mockResolvedValue([
        { id: 'usb', label: 'USB Mic', isDefault: false },
        { id: 'builtin', label: 'Built-in', isDefault: true },
    ]);
    voxMock.registerHotkey.mockResolvedValue('Cmd+Shift+Space');
    getSelectedMicDeviceIdMock.mockResolvedValue(null);
    getHotkeyComboMock.mockResolvedValue('Cmd+Shift+Space');
    setSelectedMicDeviceIdMock.mockResolvedValue();
    setHotkeyComboMock.mockResolvedValue();
});

describe('SettingsRecording', () => {
    it('loads + renders the device list with System default first', async () => {
        render(<SettingsRecording />);
        await waitFor(() => {
            expect(screen.getByLabelText(/microphone/i)).toBeInTheDocument();
        });
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        expect(select.options[0].textContent).toMatch(/system default/i);
        expect(
            Array.from(select.options).map((o) => o.textContent),
        ).toEqual(['System default', 'USB Mic', 'Built-in']);
    });

    it('persists the selected mic on change', async () => {
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'usb' } });
        await waitFor(() => {
            expect(setSelectedMicDeviceIdMock).toHaveBeenCalledWith('usb');
        });
    });

    it('persists null when System default is chosen', async () => {
        getSelectedMicDeviceIdMock.mockResolvedValueOnce('usb');
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => {
            expect(setSelectedMicDeviceIdMock).toHaveBeenCalledWith(null);
        });
    });

    it('persists + registers a new hotkey when the user captures one', async () => {
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'A', code: 'KeyA', metaKey: true, shiftKey: true }),
        );
        await waitFor(() => {
            expect(setHotkeyComboMock).toHaveBeenCalledWith('Cmd+Shift+A');
            expect(voxMock.registerHotkey).toHaveBeenCalledWith('Cmd+Shift+A');
        });
    });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `bun run test:unit -- src/windows/main/SettingsRecording.test.tsx`
Expected: FAIL — component still has the old props-based interface.

- [ ] **Step 3: Replace `SettingsRecording.tsx`**

Replace the file contents with:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HotkeyInput } from '@/components/HotkeyInput';
import { Label } from '@/components/ui/label';
import {
    getHotkeyCombo,
    getSelectedMicDeviceId,
    setHotkeyCombo,
    setSelectedMicDeviceId,
} from '@/lib/db';
import { type AudioDeviceInfo, vox } from '@/lib/invoke';
import { useCallback, useEffect, useId, useState } from 'react';

export function SettingsRecording() {
    const hotkeyId = useId();
    const deviceId = useId();
    const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [hotkey, setHotkey] = useState<string>('');
    const [testStatus, setTestStatus] = useState<'idle' | 'recording' | 'playing' | 'error'>('idle');
    const [testError, setTestError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const refreshDevices = useCallback(async () => {
        try {
            const list = await vox.listAudioInputDevices();
            setDevices(list);
        } catch {
            setDevices([]);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            const [persistedDevice, persistedHotkey] = await Promise.all([
                getSelectedMicDeviceId(),
                getHotkeyCombo(),
            ]);
            setSelectedDevice(persistedDevice ?? '');
            setHotkey(persistedHotkey);
            await refreshDevices();
        })();
    }, [refreshDevices]);

    async function handleDeviceChange(next: string) {
        setSelectedDevice(next);
        await setSelectedMicDeviceId(next === '' ? null : next);
    }

    async function handleHotkeyChange(combo: string) {
        setHotkey(combo);
        await setHotkeyCombo(combo);
        try {
            await vox.registerHotkey(combo);
        } catch (e) {
            console.error('register_hotkey failed', e);
        }
    }

    async function handleTestRecording() {
        setTestStatus('recording');
        setTestError(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        try {
            const sessionId = await vox.startRecording(
                selectedDevice === '' ? undefined : selectedDevice,
            );
            await new Promise((r) => setTimeout(r, 3000));
            const bytes = await vox.stopRecording(sessionId);
            const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setTestStatus('playing');
        } catch (e) {
            setTestError(e instanceof Error ? e.message : String(e));
            setTestStatus('error');
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recording</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={hotkeyId}>Hotkey</Label>
                    <div id={hotkeyId}>
                        <HotkeyInput value={hotkey} onChange={handleHotkeyChange} />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={deviceId}>Microphone</Label>
                    <div className="flex items-center gap-2">
                        <select
                            id={deviceId}
                            className="h-10 flex-1 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                            value={selectedDevice}
                            onChange={(e) => void handleDeviceChange(e.target.value)}
                        >
                            <option value="">System default</option>
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void refreshDevices()}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span data-testid="test-status" className="text-xs uppercase tracking-widest">
                        {testStatus === 'recording' && 'Recording 3s…'}
                        {testStatus === 'playing' && 'Captured. Press play.'}
                        {testStatus === 'error' && `Error: ${testError}`}
                    </span>
                    <Button onClick={() => void handleTestRecording()} disabled={testStatus === 'recording'}>
                        Test recording
                    </Button>
                </div>
                {audioUrl && testStatus === 'playing' && (
                    /* biome-ignore lint/a11y/useMediaCaption: test playback only */
                    <audio src={audioUrl} controls className="w-full" />
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `bun run test:unit -- src/windows/main/SettingsRecording.test.tsx`
Expected: green (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/windows/main/SettingsRecording.tsx packages/desktop/src/windows/main/SettingsRecording.test.tsx
git commit -m "feat(desktop): wire SettingsRecording with mic picker, hotkey capture, test playback"
```

---

### Task 9: Wire `MainWindow` to use the new `SettingsRecording` and trigger initial `register_hotkey`

**Files:**
- Modify: `packages/desktop/src/windows/main/MainWindow.tsx`
- Modify: `packages/desktop/src/App.tsx`

- [ ] **Step 1: Update `MainWindow.tsx`**

Replace the line `<SettingsRecording devices={[]} />` with:

```tsx
<SettingsRecording />
```

- [ ] **Step 2: Add startup hotkey registration to `App.tsx`**

In `App.tsx`, alongside whatever existing hooks live there, add an effect that runs once at startup:

```tsx
import { useEffect } from 'react';
import { getHotkeyCombo } from '@/lib/db';
import { vox } from '@/lib/invoke';
// existing imports

// inside the App component:
useEffect(() => {
    void (async () => {
        try {
            const combo = await getHotkeyCombo();
            await vox.registerHotkey(combo);
        } catch (e) {
            console.error('initial registerHotkey failed', e);
        }
    })();
}, []);
```

- [ ] **Step 3: Run typecheck + the affected tests**

Run: `bun run typecheck && bun run test:unit -- src/windows/main/MainWindow.test.tsx`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/desktop/src/windows/main/MainWindow.tsx packages/desktop/src/App.tsx
git commit -m "feat(desktop): register persisted hotkey on startup, wire SettingsRecording"
```

---

## Section 4: History DB layer

### Task 10: Soft + hard delete + restore + clear-all in `lib/db.ts`

**Files:**
- Modify: `packages/desktop/src/lib/db.ts`
- Modify: `packages/desktop/src/lib/db.test.ts`

- [ ] **Step 1: Failing tests**

Append to `db.test.ts`:

```ts
describe('db.softDeleteTranscription', () => {
    it('issues an UPDATE setting deleted_at to the current time', async () => {
        await softDeleteTranscription(42);
        const calls = fakeDb.execute.mock.calls;
        expect(calls[0][0]).toMatch(/UPDATE transcriptions SET deleted_at = \? WHERE id = \?/i);
        expect(typeof calls[0][1][0]).toBe('number');
        expect(calls[0][1][1]).toBe(42);
    });
});

describe('db.restoreTranscription', () => {
    it('clears deleted_at', async () => {
        await restoreTranscription(42);
        const calls = fakeDb.execute.mock.calls;
        expect(calls[0][0]).toMatch(
            /UPDATE transcriptions SET deleted_at = NULL WHERE id = \?/i,
        );
        expect(calls[0][1]).toEqual([42]);
    });
});

describe('db.hardDeleteTranscription', () => {
    it('issues a DELETE', async () => {
        await hardDeleteTranscription(42);
        expect(fakeDb.execute.mock.calls[0][0]).toMatch(
            /DELETE FROM transcriptions WHERE id = \?/i,
        );
    });
});

describe('db.clearAllTranscriptions', () => {
    it('hard-deletes everything and returns count', async () => {
        fakeDb.execute.mockResolvedValueOnce({ rowsAffected: 7, lastInsertId: 0 });
        const result = await clearAllTranscriptions();
        expect(result).toEqual({ deleted: 7 });
        expect(fakeDb.execute.mock.calls[0][0]).toMatch(/DELETE FROM transcriptions/i);
    });
});
```

Update the imports at the top of the test file to include the four new functions.

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Append to `db.ts`:

```ts
export async function softDeleteTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('UPDATE transcriptions SET deleted_at = ? WHERE id = ?', [
        Date.now(),
        id,
    ]);
}

export async function restoreTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('UPDATE transcriptions SET deleted_at = NULL WHERE id = ?', [id]);
}

export async function hardDeleteTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('DELETE FROM transcriptions WHERE id = ?', [id]);
}

export async function clearAllTranscriptions(): Promise<{ deleted: number }> {
    const conn = await db();
    const result = (await conn.execute('DELETE FROM transcriptions', [])) as {
        rowsAffected: number;
    };
    return { deleted: result.rowsAffected };
}
```

- [ ] **Step 4: Run, confirm pass + commit**

```bash
bun run test:unit -- src/lib/db.test.ts
git add packages/desktop/src/lib/db.ts packages/desktop/src/lib/db.test.ts
git commit -m "feat(desktop): soft + hard + restore + clear-all transcription deletes"
```

---

### Task 11: Retention helpers + `purgeOlderThan`

**Files:**
- Modify: `packages/desktop/src/lib/db.ts`
- Modify: `packages/desktop/src/lib/db.test.ts`

- [ ] **Step 1: Failing tests**

Append to `db.test.ts`:

```ts
describe('db.retentionDays', () => {
    it('returns 365 default when not set', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getRetentionDays()).resolves.toBe(365);
    });
    it('returns persisted value', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: '90' }]);
        await expect(getRetentionDays()).resolves.toBe(90);
    });
    it('persists via upsert', async () => {
        await setRetentionDays(30);
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /INSERT INTO app_state/i.test(s))).toBe(true);
    });
});

describe('db.purgeOlderThan', () => {
    it('soft-deletes old non-deleted rows and hard-deletes long-soft-deleted rows', async () => {
        fakeDb.execute
            .mockResolvedValueOnce({ rowsAffected: 3, lastInsertId: 0 })
            .mockResolvedValueOnce({ rowsAffected: 2, lastInsertId: 0 });
        const result = await purgeOlderThan(30);
        expect(result).toEqual({ softDeleted: 3, hardDeleted: 2 });
        const calls = fakeDb.execute.mock.calls;
        expect(calls[0][0]).toMatch(
            /UPDATE transcriptions SET deleted_at = \? WHERE created_at < \? AND deleted_at IS NULL/i,
        );
        expect(calls[1][0]).toMatch(
            /DELETE FROM transcriptions WHERE deleted_at IS NOT NULL AND deleted_at < \?/i,
        );
    });
    it('skips the soft-delete step when retention is forever (-1)', async () => {
        fakeDb.execute.mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 0 });
        const result = await purgeOlderThan(-1);
        expect(result.softDeleted).toBe(0);
        expect(fakeDb.execute.mock.calls).toHaveLength(1);
        expect(fakeDb.execute.mock.calls[0][0]).toMatch(/DELETE FROM transcriptions/i);
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Add a constant at the top of `db.ts`:

```ts
const RETENTION_DAYS_KEY = 'history_retention_days';
const HISTORY_LAST_SWEEP_KEY = 'history_last_sweep';
const SOFT_DELETE_GRACE_DAYS = 30;
```

Append:

```ts
export async function getRetentionDays(): Promise<number> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        RETENTION_DAYS_KEY,
    ])) as { value: string }[];
    if (!rows[0]) return 365;
    const n = Number.parseInt(rows[0].value, 10);
    return Number.isFinite(n) ? n : 365;
}

export async function setRetentionDays(days: number): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [RETENTION_DAYS_KEY, String(days)],
    );
}

export async function getHistoryLastSweep(): Promise<number | null> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        HISTORY_LAST_SWEEP_KEY,
    ])) as { value: string }[];
    if (!rows[0]) return null;
    const n = Number.parseInt(rows[0].value, 10);
    return Number.isFinite(n) ? n : null;
}

export async function setHistoryLastSweep(ms: number): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [HISTORY_LAST_SWEEP_KEY, String(ms)],
    );
}

export async function purgeOlderThan(
    retentionDays: number,
): Promise<{ softDeleted: number; hardDeleted: number }> {
    const conn = await db();
    const now = Date.now();
    let softDeleted = 0;
    if (retentionDays > 0) {
        const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
        const r = (await conn.execute(
            'UPDATE transcriptions SET deleted_at = ? WHERE created_at < ? AND deleted_at IS NULL',
            [now, cutoff],
        )) as { rowsAffected: number };
        softDeleted = r.rowsAffected;
    }
    const graceCutoff = now - SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const r = (await conn.execute(
        'DELETE FROM transcriptions WHERE deleted_at IS NOT NULL AND deleted_at < ?',
        [graceCutoff],
    )) as { rowsAffected: number };
    return { softDeleted, hardDeleted: r.rowsAffected };
}
```

- [ ] **Step 4: Run, commit**

```bash
bun run test:unit -- src/lib/db.test.ts
git add packages/desktop/src/lib/db.ts packages/desktop/src/lib/db.test.ts
git commit -m "feat(desktop): retention picker storage + purgeOlderThan sweep helper"
```

---

### Task 12: `getHistoryStats` aggregations

**Files:**
- Modify: `packages/desktop/src/lib/db.ts`
- Modify: `packages/desktop/src/lib/db.test.ts`

- [ ] **Step 1: Failing tests**

Append to `db.test.ts`:

```ts
describe('db.getHistoryStats', () => {
    it('aggregates total words, avg WPM, time saved, top provider', async () => {
        // 3 rows: 10 words / 30s, 20 words / 60s, 30 words / 90s
        fakeDb.select.mockResolvedValueOnce([
            { provider_id: 'openai', word_count: 10, duration_ms: 30000, created_at: Date.now() },
            { provider_id: 'openai', word_count: 20, duration_ms: 60000, created_at: Date.now() - 86400_000 },
            { provider_id: 'groq', word_count: 30, duration_ms: 90000, created_at: Date.now() - 2 * 86400_000 },
        ]);
        const stats = await getHistoryStats('all');
        expect(stats.totalWords).toBe(60);
        // total 180s = 3 min, total words 60. WPM = 60 / 3 = 20.
        expect(stats.avgWPM).toBeCloseTo(20, 1);
        // 60/45 - 3 = 1.33 - 3 = -1.66 → clamped to 0
        expect(stats.timeSavedMinutes).toBe(0);
        // openai has 2 rows, groq has 1
        expect(stats.topProvider).toBe('openai');
        // 3 consecutive days ending today
        expect(stats.streakDays).toBe(3);
    });

    it('returns zero/null on empty', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        const stats = await getHistoryStats('all');
        expect(stats.totalWords).toBe(0);
        expect(stats.avgWPM).toBeNull();
        expect(stats.streakDays).toBe(0);
        expect(stats.timeSavedMinutes).toBe(0);
        expect(stats.topProvider).toBeNull();
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Append to `db.ts`:

```ts
export interface HistoryStats {
    totalWords: number;
    streakDays: number;
    avgWPM: number | null;
    timeSavedMinutes: number;
    topProvider: string | null;
}

export type HistoryStatsRange = 'week' | 'month' | 'all';

interface RawStatsRow {
    provider_id: string;
    word_count: number;
    duration_ms: number;
    created_at: number;
}

function rangeStartMs(range: HistoryStatsRange, now: number): number | null {
    const day = 24 * 60 * 60 * 1000;
    if (range === 'week') return now - 7 * day;
    if (range === 'month') return now - 30 * day;
    return null;
}

function computeStreakDays(rows: RawStatsRow[], now: number): number {
    if (rows.length === 0) return 0;
    const day = 24 * 60 * 60 * 1000;
    const startOfDay = (ms: number) => {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };
    const today = startOfDay(now);
    const days = new Set<number>(rows.map((r) => startOfDay(r.created_at)));
    let streak = 0;
    let cursor = today;
    while (days.has(cursor)) {
        streak++;
        cursor -= day;
    }
    return streak;
}

export async function getHistoryStats(range: HistoryStatsRange): Promise<HistoryStats> {
    const conn = await db();
    const now = Date.now();
    const start = rangeStartMs(range, now);
    const rows = (await conn.select(
        start === null
            ? 'SELECT provider_id, word_count, duration_ms, created_at FROM transcriptions WHERE deleted_at IS NULL'
            : 'SELECT provider_id, word_count, duration_ms, created_at FROM transcriptions WHERE deleted_at IS NULL AND created_at >= ?',
        start === null ? [] : [start],
    )) as RawStatsRow[];
    if (rows.length === 0) {
        return {
            totalWords: 0,
            streakDays: 0,
            avgWPM: null,
            timeSavedMinutes: 0,
            topProvider: null,
        };
    }
    const totalWords = rows.reduce((a, r) => a + r.word_count, 0);
    const totalMs = rows.reduce((a, r) => a + r.duration_ms, 0);
    const totalMinutes = totalMs / 60000;
    const avgWPM = totalMs > 0 ? totalWords / totalMinutes : null;
    const typingMinutes = totalWords / 45;
    const timeSavedMinutes = Math.max(0, typingMinutes - totalMinutes);
    const counts = new Map<string, number>();
    for (const r of rows) {
        counts.set(r.provider_id, (counts.get(r.provider_id) ?? 0) + 1);
    }
    let topProvider: string | null = null;
    let topCount = 0;
    for (const [p, c] of counts) {
        if (c > topCount) {
            topProvider = p;
            topCount = c;
        }
    }
    return {
        totalWords,
        streakDays: computeStreakDays(rows, now),
        avgWPM,
        timeSavedMinutes,
        topProvider,
    };
}
```

- [ ] **Step 4: Run + commit**

```bash
bun run test:unit -- src/lib/db.test.ts
git add packages/desktop/src/lib/db.ts packages/desktop/src/lib/db.test.ts
git commit -m "feat(desktop): getHistoryStats aggregations"
```

---

## Section 5: History UI

### Task 13: Export helper (`lib/export.ts`)

**Files:**
- Create: `packages/desktop/src/lib/export.ts`
- Create: `packages/desktop/src/lib/export.test.ts`

- [ ] **Step 1: Failing tests**

Create `export.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatRowAsTxt, formatRowAsMd, formatBulkAsMd } from './export';

const row = {
    id: 1,
    createdAt: new Date('2026-05-09T10:00:00Z').getTime(),
    text: 'Hello world.',
    durationMs: 4500,
    wordCount: 2,
    providerId: 'openai',
    modelId: 'whisper-1',
};

describe('export.formatRowAsTxt', () => {
    it('returns just the text', () => {
        expect(formatRowAsTxt(row)).toBe('Hello world.');
    });
});

describe('export.formatRowAsMd', () => {
    it('renders an H1 + metadata + blockquote', () => {
        const md = formatRowAsMd(row);
        expect(md).toMatch(/^# Transcription/);
        expect(md).toContain('Provider: openai');
        expect(md).toContain('Model: whisper-1');
        expect(md).toContain('Words: 2');
        expect(md).toContain('> Hello world.');
    });
});

describe('export.formatBulkAsMd', () => {
    it('renders an H1 followed by H2 sections per row', () => {
        const md = formatBulkAsMd([row, { ...row, id: 2, text: 'Two.' }], 'all');
        expect(md.startsWith('# Vox Era')).toBe(true);
        expect((md.match(/^## Transcription/gm) ?? []).length).toBe(2);
        expect(md).toContain('Hello world.');
        expect(md).toContain('Two.');
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Create `export.ts`:

```ts
import type { TranscriptionRow } from './db';

function iso(ms: number): string {
    return new Date(ms).toISOString();
}

function durationLabel(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRowAsTxt(row: TranscriptionRow): string {
    return row.text;
}

export function formatRowAsMd(row: TranscriptionRow): string {
    return [
        `# Transcription · ${iso(row.createdAt)}`,
        '',
        `- Provider: ${row.providerId}`,
        `- Model: ${row.modelId}`,
        `- Duration: ${durationLabel(row.durationMs)}`,
        `- Words: ${row.wordCount}`,
        '',
        `> ${row.text.replace(/\n/g, '\n> ')}`,
        '',
    ].join('\n');
}

export function formatBulkAsMd(rows: readonly TranscriptionRow[], rangeLabel: string): string {
    const header = `# Vox Era — Transcription Export · ${rangeLabel}\n\n`;
    const body = rows
        .map((row) =>
            [
                `## Transcription · ${iso(row.createdAt)}`,
                '',
                `- Provider: ${row.providerId}`,
                `- Model: ${row.modelId}`,
                `- Duration: ${durationLabel(row.durationMs)}`,
                `- Words: ${row.wordCount}`,
                '',
                `> ${row.text.replace(/\n/g, '\n> ')}`,
                '',
            ].join('\n'),
        )
        .join('\n');
    return header + body;
}

export function downloadBlob(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Run + commit**

```bash
bun run test:unit -- src/lib/export.test.ts
git add packages/desktop/src/lib/export.ts packages/desktop/src/lib/export.test.ts
git commit -m "feat(desktop): export helpers for .txt + .md (per-row + bulk)"
```

---

### Task 14: `History.tsx` per-row Copy / Export / Delete with undo + bulk export

**Files:**
- Modify: `packages/desktop/src/windows/main/History.tsx`
- Modify: `packages/desktop/src/windows/main/History.test.tsx`

- [ ] **Step 1: Failing tests**

Replace `History.test.tsx` body with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { History } from './History';

function makeEntry(over: Partial<Parameters<typeof History>[0]['entries'][number]> = {}) {
    return {
        id: '1',
        text: 'Hello world.',
        provider: 'openai',
        model: 'whisper-1',
        createdAt: '2026-05-09T10:00:00Z',
        durationMs: 4500,
        wordCount: 2,
        ...over,
    };
}

describe('History row actions', () => {
    it('renders Copy, Export, Delete buttons per row', () => {
        render(<History entries={[makeEntry()]} onDelete={vi.fn()} />);
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('Delete fires onDelete with the row id', () => {
        const onDelete = vi.fn();
        render(<History entries={[makeEntry()]} onDelete={onDelete} />);
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('Copy writes the text to the clipboard', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
        render(<History entries={[makeEntry()]} onDelete={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /copy/i }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hello world.'));
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Replace `History.tsx` body. The existing component already does search/filter/pagination; add per-row actions and an `onDelete` prop.

Update `HistoryEntry` interface:

```ts
export interface HistoryEntry {
    id: string;
    text: string;
    provider: string;
    model: string;
    createdAt: string;
    durationMs: number;
    wordCount: number;
}

export interface HistoryProps {
    entries: readonly HistoryEntry[];
    pageSize?: number;
    onDelete?: (id: string) => void;
    onExportFiltered?: (rows: readonly HistoryEntry[]) => void;
}
```

In the row render block, replace the current card body with:

```tsx
<Card>
    <CardContent className="flex flex-col gap-2 text-sm font-medium normal-case">
        <p className="text-base">{entry.text}</p>
        <p className="text-xs uppercase tracking-wider opacity-70">
            {entry.provider} · {entry.model} · {entry.createdAt}
        </p>
        <div className="flex flex-wrap gap-2">
            <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(entry.text)}
            >
                Copy
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => exportRow(entry, 'txt')}
            >
                Export .txt
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => exportRow(entry, 'md')}
            >
                Export .md
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete?.(entry.id)}>
                Delete
            </Button>
        </div>
    </CardContent>
</Card>
```

Add at the top of `History.tsx`:

```ts
import { downloadBlob, formatBulkAsMd, formatRowAsMd, formatRowAsTxt } from '@/lib/export';
import type { TranscriptionRow } from '@/lib/db';

function toTranscriptionRow(e: HistoryEntry): TranscriptionRow {
    return {
        id: Number(e.id),
        createdAt: Date.parse(e.createdAt),
        text: e.text,
        durationMs: e.durationMs,
        wordCount: e.wordCount,
        providerId: e.provider,
        modelId: e.model,
    };
}

function exportRow(e: HistoryEntry, format: 'txt' | 'md') {
    const row = toTranscriptionRow(e);
    if (format === 'txt') {
        downloadBlob(`vox-era-${row.id}.txt`, formatRowAsTxt(row), 'text/plain');
    } else {
        downloadBlob(`vox-era-${row.id}.md`, formatRowAsMd(row), 'text/markdown');
    }
}
```

At the section header (where the search/provider filter lives), add a button:

```tsx
<Button
    size="sm"
    variant="outline"
    onClick={() => {
        const md = formatBulkAsMd(filtered.map(toTranscriptionRow), 'filtered');
        downloadBlob('vox-era-history.md', md, 'text/markdown');
        onExportFiltered?.(filtered);
    }}
>
    Export filtered
</Button>
```

- [ ] **Step 4: Run + commit**

```bash
bun run test:unit -- src/windows/main/History.test.tsx
git add packages/desktop/src/windows/main/History.tsx packages/desktop/src/windows/main/History.test.tsx
git commit -m "feat(desktop): per-row Copy/Export/Delete + bulk export on History tab"
```

---

### Task 15: Rewrite `SettingsHistory.tsx`

**Files:**
- Modify: `packages/desktop/src/windows/main/SettingsHistory.tsx`
- Modify: `packages/desktop/src/windows/main/SettingsHistory.test.tsx`

- [ ] **Step 1: Failing tests**

Replace `SettingsHistory.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsHistory } from './SettingsHistory';

vi.mock('@/lib/db', () => ({
    getRetentionDays: vi.fn(),
    setRetentionDays: vi.fn(),
    purgeOlderThan: vi.fn(),
    clearAllTranscriptions: vi.fn(),
}));

import {
    clearAllTranscriptions,
    getRetentionDays,
    purgeOlderThan,
    setRetentionDays,
} from '@/lib/db';

beforeEach(() => {
    vi.mocked(getRetentionDays).mockResolvedValue(365);
    vi.mocked(setRetentionDays).mockResolvedValue();
    vi.mocked(purgeOlderThan).mockResolvedValue({ softDeleted: 0, hardDeleted: 0 });
    vi.mocked(clearAllTranscriptions).mockResolvedValue({ deleted: 0 });
});

describe('SettingsHistory', () => {
    it('loads + renders the persisted retention value', async () => {
        vi.mocked(getRetentionDays).mockResolvedValueOnce(90);
        render(<SettingsHistory />);
        await waitFor(() => {
            const select = screen.getByLabelText(/retain/i) as HTMLSelectElement;
            expect(select.value).toBe('90');
        });
    });

    it('persists + sweeps when changing retention', async () => {
        render(<SettingsHistory />);
        await waitFor(() => screen.getByLabelText(/retain/i));
        fireEvent.change(screen.getByLabelText(/retain/i), { target: { value: '30' } });
        await waitFor(() => {
            expect(setRetentionDays).toHaveBeenCalledWith(30);
            expect(purgeOlderThan).toHaveBeenCalledWith(30);
        });
    });

    it('Clear all opens a confirmation, only clears on confirm', async () => {
        render(<SettingsHistory />);
        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
        // cancel does NOT clear
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(clearAllTranscriptions).not.toHaveBeenCalled();
        // confirm DOES clear
        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
        await waitFor(() => expect(clearAllTranscriptions).toHaveBeenCalled());
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Replace `SettingsHistory.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    clearAllTranscriptions,
    getRetentionDays,
    purgeOlderThan,
    setRetentionDays,
} from '@/lib/db';
import { useEffect, useId, useState } from 'react';

const OPTIONS = [
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: '365 days (default)' },
    { value: -1, label: 'Forever' },
];

export function SettingsHistory() {
    const retainId = useId();
    const [retainDays, setRetainDays] = useState<number>(365);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        void getRetentionDays().then(setRetainDays);
    }, []);

    async function handleChange(next: number) {
        setRetainDays(next);
        await setRetentionDays(next);
        await purgeOlderThan(next);
    }

    async function handleConfirmClear() {
        await clearAllTranscriptions();
        setConfirming(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={retainId}>Retain transcriptions for</Label>
                    <select
                        id={retainId}
                        className="h-10 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                        value={String(retainDays)}
                        onChange={(e) => void handleChange(Number(e.target.value))}
                    >
                        {OPTIONS.map((o) => (
                            <option key={o.value} value={String(o.value)}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => setConfirming(true)}>
                        Clear all
                    </Button>
                </div>
                {confirming && (
                    <div className="flex flex-col gap-2 border-3 border-border bg-yellow-100 p-3">
                        <p>This deletes all transcriptions and cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => void handleConfirmClear()}>
                                Confirm
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 4: Run + commit**

```bash
bun run test:unit -- src/windows/main/SettingsHistory.test.tsx
git add packages/desktop/src/windows/main/SettingsHistory.tsx packages/desktop/src/windows/main/SettingsHistory.test.tsx
git commit -m "feat(desktop): wire SettingsHistory with retention picker + Clear all"
```

---

### Task 16: Rewrite `Dashboard.tsx` to render stats from `getHistoryStats`

**Files:**
- Modify: `packages/desktop/src/windows/main/Dashboard.tsx`
- Modify: `packages/desktop/src/windows/main/Dashboard.test.tsx`

- [ ] **Step 1: Failing tests**

Replace `Dashboard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';

vi.mock('@/lib/db', () => ({
    getHistoryStats: vi.fn(),
}));

import { getHistoryStats } from '@/lib/db';

beforeEach(() => {
    vi.mocked(getHistoryStats).mockResolvedValue({
        totalWords: 1234,
        streakDays: 5,
        avgWPM: 42.5,
        timeSavedMinutes: 12.3,
        topProvider: 'openai',
    });
});

describe('Dashboard', () => {
    it('renders five stat cards from getHistoryStats', async () => {
        render(<Dashboard />);
        await waitFor(() => expect(screen.getByText('1,234')).toBeInTheDocument());
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText(/42\.5/)).toBeInTheDocument();
        expect(screen.getByText(/12\.3/)).toBeInTheDocument();
        expect(screen.getByText('openai')).toBeInTheDocument();
    });

    it('renders — placeholders when stats are null', async () => {
        vi.mocked(getHistoryStats).mockResolvedValueOnce({
            totalWords: 0,
            streakDays: 0,
            avgWPM: null,
            timeSavedMinutes: 0,
            topProvider: null,
        });
        render(<Dashboard />);
        await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    });
});
```

- [ ] **Step 2: Run, confirm fail**

- [ ] **Step 3: Implement**

Replace `Dashboard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type HistoryStats, getHistoryStats } from '@/lib/db';
import { useEffect, useState } from 'react';

export interface DashboardProps {
    /** When recordingState transitions to idle, the parent can bump this prop
     * to force a stats refetch. Defaults to 0 (no auto-refetch). */
    refreshKey?: number;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <Card>
            <CardHeader className="pb-1">
                <CardTitle className="text-xs uppercase tracking-widest">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-extrabold">{value}</CardContent>
        </Card>
    );
}

export function Dashboard({ refreshKey = 0 }: DashboardProps) {
    const [stats, setStats] = useState<HistoryStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getHistoryStats('all').then((s) => {
            if (!cancelled) setStats(s);
        });
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const totalWords = stats ? stats.totalWords.toLocaleString() : '—';
    const streakDays = stats ? String(stats.streakDays) : '—';
    const avgWPM = stats?.avgWPM != null ? stats.avgWPM.toFixed(1) : '—';
    const timeSaved = stats ? `${stats.timeSavedMinutes.toFixed(1)} min` : '—';
    const topProvider = stats?.topProvider ?? '—';

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total words" value={totalWords} />
            <Stat label="Streak (days)" value={streakDays} />
            <Stat label="Avg WPM" value={avgWPM} />
            <Stat label="Time saved" value={timeSaved} />
            <Stat label="Top provider" value={topProvider} />
        </div>
    );
}
```

- [ ] **Step 4: Run + commit**

```bash
bun run test:unit -- src/windows/main/Dashboard.test.tsx
git add packages/desktop/src/windows/main/Dashboard.tsx packages/desktop/src/windows/main/Dashboard.test.tsx
git commit -m "feat(desktop): Dashboard renders 5 stats from getHistoryStats"
```

---

## Section 6: Integration

### Task 17: Daily retention sweep in `App.tsx`

**Files:**
- Modify: `packages/desktop/src/App.tsx`

- [ ] **Step 1: Implement (no test — thin glue, exercised by integration)**

In `App.tsx`, add after the existing `registerHotkey` startup effect:

```tsx
import {
    getHistoryLastSweep,
    getRetentionDays,
    purgeOlderThan,
    setHistoryLastSweep,
} from '@/lib/db';

// inside the App component, alongside the existing useEffect:
useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function runSweep() {
        const days = await getRetentionDays();
        const last = await getHistoryLastSweep();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (last == null || now - last >= dayMs) {
            await purgeOlderThan(days);
            await setHistoryLastSweep(now);
        }
        if (cancelled) return;
        const nextDelay = Math.max(60_000, dayMs - (now - (last ?? now)));
        timer = setTimeout(() => void runSweep(), nextDelay);
    }

    void runSweep();
    return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
    };
}, []);
```

- [ ] **Step 2: Verify typecheck + commit**

```bash
bun run typecheck
git add packages/desktop/src/App.tsx
git commit -m "feat(desktop): daily retention sweep on app mount"
```

---

### Task 18: Wire `MainWindow` for Dashboard refresh + History delete + the new SettingsHistory

**Files:**
- Modify: `packages/desktop/src/windows/main/MainWindow.tsx`

- [ ] **Step 1: Implement**

Replace `MainWindow.tsx`'s body so the Dashboard refreshes when recording returns to idle, and the History tab wires `onDelete` to the soft-delete + undo flow:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { useHotkeyRecording } from '@/hooks/useHotkeyRecording';
import {
    listTranscriptions,
    restoreTranscription,
    softDeleteTranscription,
} from '@/lib/db';
import { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './Dashboard';
import { History, type HistoryEntry } from './History';
import { RecordingStatusPill } from './RecordingStatusPill';
import { SettingsApiKeys } from './SettingsApiKeys';
import { SettingsHistory } from './SettingsHistory';
import { SettingsModelConfigs } from './SettingsModelConfigs';
import { SettingsOverlay } from './SettingsOverlay';
import { SettingsRecording } from './SettingsRecording';
import { SettingsTheme } from './SettingsTheme';
import { SettingsUpdates } from './SettingsUpdates';

function formatCreatedAt(ms: number): string {
    return new Date(ms).toISOString();
}

interface UndoToastState {
    open: boolean;
    rowId: number | null;
}

export function MainWindow() {
    const { state: recordingState } = useHotkeyRecording();
    const [historyEntries, setHistoryEntries] = useState<readonly HistoryEntry[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [undoToast, setUndoToast] = useState<UndoToastState>({ open: false, rowId: null });

    const loadHistory = useCallback(async () => {
        try {
            const rows = await listTranscriptions({ limit: 200 });
            setHistoryEntries(
                rows.map((r) => ({
                    id: String(r.id),
                    text: r.text,
                    provider: r.providerId,
                    model: r.modelId,
                    createdAt: formatCreatedAt(r.createdAt),
                    durationMs: r.durationMs,
                    wordCount: r.wordCount,
                })),
            );
        } catch (e) {
            console.error('listTranscriptions failed', e);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
        if (recordingState.kind === 'idle') {
            setRefreshKey((k) => k + 1);
        }
    }, [loadHistory, recordingState.kind]);

    async function handleDelete(rowId: string) {
        const id = Number(rowId);
        if (!Number.isFinite(id)) return;
        await softDeleteTranscription(id);
        await loadHistory();
        setUndoToast({ open: true, rowId: id });
    }

    async function handleUndo() {
        if (undoToast.rowId == null) return;
        await restoreTranscription(undoToast.rowId);
        setUndoToast({ open: false, rowId: null });
        await loadHistory();
    }

    return (
        <main className="min-h-screen bg-bg p-6 text-fg">
            <header className="mb-6 flex flex-row items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold uppercase tracking-tight">Vox Era</h1>
                    <p className="text-sm font-medium">Multi-provider speech-to-text.</p>
                </div>
                <RecordingStatusPill state={recordingState} />
            </header>
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard" data-testid="panel-dashboard">
                    <Dashboard refreshKey={refreshKey} />
                </TabsContent>
                <TabsContent value="history" data-testid="panel-history">
                    <History entries={historyEntries} onDelete={handleDelete} />
                </TabsContent>
                <TabsContent
                    value="settings"
                    data-testid="panel-settings"
                    className="flex flex-col gap-6"
                >
                    <SettingsApiKeys />
                    <SettingsModelConfigs />
                    <SettingsRecording />
                    <SettingsOverlay />
                    <SettingsHistory />
                    <SettingsTheme />
                    <SettingsUpdates />
                </TabsContent>
                <TabsContent value="about" data-testid="panel-about">
                    <p className="text-sm opacity-60">About placeholder.</p>
                </TabsContent>
            </Tabs>
            <Toast
                open={undoToast.open}
                message="Transcription deleted."
                duration={5000}
                onClose={() => setUndoToast({ open: false, rowId: null })}
            />
            {undoToast.open && (
                <div className="fixed top-20 right-6 z-50">
                    <Button size="sm" variant="outline" onClick={() => void handleUndo()}>
                        Undo
                    </Button>
                </div>
            )}
        </main>
    );
}
```

Note: the existing `Toast` component (commit `2d284fc`) is a controlled message-only display — it has no built-in action button. The Undo button is rendered as a sibling and disappears when the toast closes. If you want a richer Toast with an action slot, that's a separate refactor; keeping it lean here.

- [ ] **Step 2: Verify the affected tests pass**

Run: `bun run typecheck && bun run test:unit -- src/windows/main/MainWindow.test.tsx`
Expected: green. If `MainWindow.test.tsx` references the old `<History entries={[]} />` form, update it to assert the new wiring — the failing tests will tell you what to fix.

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/windows/main/MainWindow.tsx
git commit -m "feat(desktop): MainWindow wires soft-delete-with-undo + Dashboard refresh"
```

---

## Section 7: Cleanup

### Task 19: Remove dead Rust history modules

**Files:**
- Delete: `packages/desktop/src-tauri/src/history/repo.rs`
- Delete: `packages/desktop/src-tauri/src/history/retention.rs`
- Delete: `packages/desktop/src-tauri/src/history/stats.rs`
- Modify: `packages/desktop/src-tauri/src/history/mod.rs` (strip DAO re-exports; keep only `DB_URL` + `migrations()`)

- [ ] **Step 1: Read the existing `history/mod.rs` to confirm DB_URL + migrations() shape**

Use `mcp__plugin_woz_code__Search` to read the file. Identify the exports `DB_URL` and the `migrations()` function. Anything else (re-exports of `repo`, `retention`, `stats`) is the dead code we'll remove.

- [ ] **Step 2: Delete the three dead files**

```bash
git rm packages/desktop/src-tauri/src/history/repo.rs
git rm packages/desktop/src-tauri/src/history/retention.rs
git rm packages/desktop/src-tauri/src/history/stats.rs
```

- [ ] **Step 3: Trim `history/mod.rs`**

Replace its contents with just:

```rust
//! Migrations registration for `tauri-plugin-sql`. The actual data
//! access lives in JS (`packages/desktop/src/lib/db.ts`).

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:vox-era.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create transcriptions table",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create api_keys, model_configs, app_state",
            sql: include_str!("../../migrations/0002_provider_configs.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
```

(If the existing version differs in the relative `include_str!` path or migration list, keep the existing values — only strip the DAO/stats/retention re-exports.)

- [ ] **Step 4: Verify build**

Run: `cargo check && cargo test --lib`
Expected: clean compile, no test regressions (the deleted modules' tests are gone with them).

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/history/
git commit -m "chore(desktop): remove dead Rust history modules (now in lib/db.ts)"
```

---

## Section 8: Final verification

### Task 20: Full repo check

**Files:** none.

- [ ] **Step 1: Lint, typecheck, test**

Run (from repo root):
```bash
bun run lint
bun run typecheck
bun --cwd packages/desktop run test
cd packages/desktop/src-tauri && cargo test --lib
```
Expected: all green.

- [ ] **Step 2: Build the Vite bundle**

Run: `bun --cwd packages/desktop run build`
Expected: clean static build to `packages/desktop/dist/`.

- [ ] **Step 3: Smoke run (manual, on macOS)**

Run: `bun --cwd packages/desktop run tauri:dev`

Manual checklist:
- Settings → Recording: the device list populates, default is "System default", changing the picker persists across restart.
- Settings → Recording: click "Capture…", press a combo, the field updates and the new combo registers (try pressing it from another app).
- Settings → Recording: "Test recording" → records 3 sec → audio playback control appears.
- Settings → History: change retention, see the SQL execute via devtools network/log; "Clear all" prompts then deletes.
- History tab: each row shows Copy / Export .txt / Export .md / Delete; Delete shows undo toast that restores the row.
- Dashboard: 5 cards render with real numbers after at least one transcription.
- After ~24h (or by setting `history_last_sweep` to an old timestamp manually via the JS console), the daily sweep runs.

- [ ] **Step 4: No commit needed unless smoke-test changes are required.**

---

## Plan complete

20 tasks across 8 sections. The only manual step that can't be unit-tested is the smoke run in Task 20 Step 3.
