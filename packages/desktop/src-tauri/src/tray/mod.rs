//! System tray module.
//!
//! For Plan B this provides:
//! - Menu item id constants (`menu_ids`) so other modules can reference the
//!   same strings the tray emits.
//! - A `TrayEvent` enum modeling each user-driven menu action.
//! - A pure `dispatch_event` mapper from raw menu ids to `TrayEvent`s, which
//!   keeps the bulk of the tray's logic testable without a Tauri runtime.
//! - A `build` function that constructs the real tray icon + menu via
//!   `TrayIconBuilder`. `build` is not exercised by unit tests (it requires a
//!   live `AppHandle`); full setup wiring lands in a later task.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime,
};

/// Stable identifiers for the tray menu items. Kept in one place so callers
/// (the tray builder, the menu-event dispatcher, and tests) can't drift.
pub mod menu_ids {
    pub const OPEN_MAIN: &str = "open_main";
    pub const SWITCH_PROVIDER: &str = "switch_provider_label";
    pub const QUIT: &str = "quit";
}

/// Events emitted when a tray menu item is clicked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrayEvent {
    /// Show / focus the main window.
    OpenMain,
    /// User clicked the "Switch provider →" entry. The actual submenu wiring
    /// lands in a later task; for now this is a no-op marker.
    SwitchProvider,
    /// Quit the application.
    Quit,
}

/// Map a raw menu item id (the string that `MenuItem::with_id` was created
/// with) to a `TrayEvent`. Returns `None` for unknown ids so the dispatcher
/// can ignore them gracefully.
pub fn dispatch_event(id: &str) -> Option<TrayEvent> {
    match id {
        menu_ids::OPEN_MAIN => Some(TrayEvent::OpenMain),
        menu_ids::SWITCH_PROVIDER => Some(TrayEvent::SwitchProvider),
        menu_ids::QUIT => Some(TrayEvent::Quit),
        _ => None,
    }
}

/// Build the system tray icon + menu and register it with the app.
///
/// The tray uses the default app icon and exposes a minimal menu:
/// * "Open Vox Era"          — show & focus the main window
/// * "Switch provider →"     — placeholder; submenu wired up later
/// * separator
/// * "Quit Vox Era"          — exits the process
///
/// Status / provider / stats display rows from the spec (§6.11) are not
/// included here because they need live state from settings + history. They
/// land in the commands aggregation task.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open_main = MenuItem::with_id(
        app,
        menu_ids::OPEN_MAIN,
        "Open Vox Era",
        true,
        None::<&str>,
    )?;
    let switch_provider = MenuItem::with_id(
        app,
        menu_ids::SWITCH_PROVIDER,
        "Switch provider →",
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, menu_ids::QUIT, "Quit Vox Era", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_main, &switch_provider, &separator, &quit])?;

    let icon = app
        .default_window_icon()
        .ok_or_else(|| {
            tauri::Error::AssetNotFound(
                "default window icon (icons/icon.png) not found; cannot build tray icon".into(),
            )
        })?
        .clone();

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match dispatch_event(event.id.as_ref()) {
            Some(TrayEvent::OpenMain) => {
                #[cfg(target_os = "macos")]
                {
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                }
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Some(TrayEvent::Quit) => {
                app.exit(0);
            }
            Some(TrayEvent::SwitchProvider) | None => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dispatch_event_maps_open_main() {
        assert_eq!(
            dispatch_event(menu_ids::OPEN_MAIN),
            Some(TrayEvent::OpenMain)
        );
    }

    #[test]
    fn dispatch_event_maps_switch_provider() {
        assert_eq!(
            dispatch_event(menu_ids::SWITCH_PROVIDER),
            Some(TrayEvent::SwitchProvider)
        );
    }

    #[test]
    fn dispatch_event_maps_quit() {
        assert_eq!(dispatch_event(menu_ids::QUIT), Some(TrayEvent::Quit));
    }

    #[test]
    fn dispatch_event_returns_none_for_unknown_id() {
        assert_eq!(dispatch_event("who_knows"), None);
        assert_eq!(dispatch_event(""), None);
    }

    #[test]
    fn menu_ids_are_distinct() {
        let ids = [menu_ids::OPEN_MAIN, menu_ids::SWITCH_PROVIDER, menu_ids::QUIT];
        for (i, a) in ids.iter().enumerate() {
            for b in ids.iter().skip(i + 1) {
                assert_ne!(a, b, "menu ids must be unique");
            }
        }
    }

    #[test]
    fn tray_event_is_clone_and_eq() {
        // Compile-time check that TrayEvent satisfies the derives we rely on.
        let e = TrayEvent::OpenMain;
        let e2 = e.clone();
        assert_eq!(e, e2);
    }
}
