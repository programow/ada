/**
 * Default global push-to-talk hotkey on macOS. Cmd+Shift+Space is unbound
 * by the system, doesn't collide with Spotlight (Cmd+Space) or the
 * input-source switcher (Ctrl+Space), and keeps the recording shortcut in
 * the same physical position as on Windows / Linux.
 */
export const DEFAULT_HOTKEY_MAC = 'Cmd+Shift+Space';

/**
 * Default global push-to-talk hotkey on every non-macOS platform. Windows
 * and most Linux WMs leave Ctrl+Shift+Space unclaimed, so we pick a single
 * combo and use it everywhere outside macOS to keep documentation simple.
 */
export const DEFAULT_HOTKEY_OTHER = 'Ctrl+Shift+Space';
