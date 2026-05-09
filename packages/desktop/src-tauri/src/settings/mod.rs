use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub active_provider_id: String,
    pub active_model_id: String,
    pub hotkey: String,
    pub mic_device_id: Option<String>,
    pub theme: Theme,
    pub history: HistorySettings,
    pub overlay: OverlaySettings,
    pub onboarding_completed: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistorySettings {
    pub retention_days: i32,
    pub auto_delete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub position: OverlayPosition,
    pub show_on_idle: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayPosition {
    BottomCenter,
    BottomRight,
    TopCenter,
}

impl Settings {
    pub fn defaults() -> Self {
        Self {
            active_provider_id: "openai".into(),
            active_model_id: "whisper-1".into(),
            hotkey: default_hotkey().into(),
            mic_device_id: None,
            theme: Theme::System,
            history: HistorySettings {
                retention_days: 365,
                auto_delete: true,
            },
            overlay: OverlaySettings {
                position: OverlayPosition::BottomCenter,
                show_on_idle: false,
            },
            onboarding_completed: false,
        }
    }
}

pub fn default_hotkey() -> &'static str {
    if cfg!(target_os = "macos") {
        "Fn"
    } else {
        "CommandOrControl+Shift+Space"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_use_openai_whisper_and_one_year_retention() {
        let s = Settings::defaults();
        assert_eq!(s.active_provider_id, "openai");
        assert_eq!(s.active_model_id, "whisper-1");
        assert_eq!(s.history.retention_days, 365);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn macos_default_hotkey_is_fn() {
        assert_eq!(default_hotkey(), "Fn");
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn non_macos_default_hotkey_is_ctrl_shift_space() {
        assert_eq!(default_hotkey(), "CommandOrControl+Shift+Space");
    }

    #[test]
    fn settings_round_trip_serialize() {
        let s = Settings::defaults();
        let j = serde_json::to_string(&s).unwrap();
        let parsed: Settings = serde_json::from_str(&j).unwrap();
        assert_eq!(parsed, s);
    }
}
