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
                mods |= Modifiers::SUPER;
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
    if shortcut.mods.contains(Modifiers::SUPER) {
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
        assert_eq!(s.mods, Modifiers::SUPER | Modifiers::SHIFT);
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
