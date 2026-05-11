import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getOverlayEnabled } from './db';
import { EVT_SHORTCUT_TOGGLE } from './markers';
import type { RecordingState } from './recording-controller';

export const RECORDING_STATE_EVENT = 'vox-era://recording-state';
export const OVERLAY_POSITION_SETUP_ON_EVENT = 'vox-era://overlay-position-setup-on';
export const OVERLAY_POSITION_SETUP_OFF_EVENT = 'vox-era://overlay-position-setup-off';
export const OVERLAY_RESET_POSITION_EVENT = 'vox-era://overlay-reset-position';

const OVERLAY_LABEL = 'overlay';

async function shouldShowOverlay(state: RecordingState): Promise<boolean> {
    if (state.kind !== 'recording' && state.kind !== 'transcribing') return false;
    try {
        return await getOverlayEnabled();
    } catch (e) {
        // If the setting can't be read, fall back to showing — don't silently
        // strand the user without feedback.
        console.warn('overlay-bridge: getOverlayEnabled failed, defaulting to true', e);
        return true;
    }
}

/**
 * Broadcast a recording state transition to the overlay window: emits a
 * Tauri event the overlay listens for, then shows or hides the overlay's
 * OS window based on the state kind and the user's `overlay_enabled`
 * setting. Side-effect-only and never throws — an overlay quirk must not
 * break the recording flow.
 */
export async function publishRecordingState(state: RecordingState): Promise<void> {
    try {
        await emit(RECORDING_STATE_EVENT, state);
    } catch (e) {
        console.warn('overlay-bridge: emit failed', e);
    }
    let overlay: Awaited<ReturnType<typeof WebviewWindow.getByLabel>> | null = null;
    try {
        overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL);
    } catch (e) {
        console.warn('overlay-bridge: getByLabel failed', e);
        return;
    }
    if (!overlay) return;
    try {
        if (await shouldShowOverlay(state)) {
            await overlay.show();
        } else {
            await overlay.hide();
        }
    } catch (e) {
        console.warn('overlay-bridge: show/hide failed', e);
    }
}

/**
 * Hide the overlay window unconditionally. Used by the settings toggle so
 * that disabling the overlay mid-session takes effect immediately instead
 * of waiting for the next state transition.
 */
export async function hideOverlayWindow(): Promise<void> {
    try {
        const overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL);
        await overlay?.hide();
    } catch (e) {
        console.warn('overlay-bridge: hideOverlayWindow failed', e);
    }
}

/**
 * Start "set position" mode: tell the overlay to render its positioning
 * pill and show the OS window so the user can drag it.
 */
export async function enterOverlayPositionSetup(): Promise<void> {
    try {
        await emit(OVERLAY_POSITION_SETUP_ON_EVENT, null);
    } catch (e) {
        console.warn('overlay-bridge: enterOverlayPositionSetup emit failed', e);
    }
    try {
        const overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL);
        await overlay?.show();
    } catch (e) {
        console.warn('overlay-bridge: enterOverlayPositionSetup show failed', e);
    }
}

/** Why setup mode is exiting — drives whether to surface a confirmation toast. */
export type SetupExitReason = 'manual' | 'idle' | 'recording-wins';

export interface SetupExitPayload {
    reason: SetupExitReason;
}

/**
 * End "set position" mode. Always emits the off event so listeners on both
 * sides can sync their state. If `hide` is true, also hides the OS window;
 * pass `false` when something else (a recording transition) is keeping the
 * window visible.
 */
export async function exitOverlayPositionSetup(
    options: { hide: boolean; reason?: SetupExitReason } = { hide: true },
): Promise<void> {
    const reason: SetupExitReason = options.reason ?? 'manual';
    try {
        const payload: SetupExitPayload = { reason };
        await emit(OVERLAY_POSITION_SETUP_OFF_EVENT, payload);
    } catch (e) {
        console.warn('overlay-bridge: exitOverlayPositionSetup emit failed', e);
    }
    if (!options.hide) return;
    try {
        const overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL);
        await overlay?.hide();
    } catch (e) {
        console.warn('overlay-bridge: exitOverlayPositionSetup hide failed', e);
    }
}

/**
 * Trigger the overlay to recompute its default bottom-center position. The
 * overlay listens for this event and calls `setPosition`; its existing
 * onMoved-debounce save will then write the default coords to db.
 */
export async function resetOverlayPosition(): Promise<void> {
    try {
        await emit(OVERLAY_RESET_POSITION_EVENT, null);
    } catch (e) {
        console.warn('overlay-bridge: resetOverlayPosition emit failed', e);
    }
}

/**
 * Request that the recording state machine toggle (idle→recording or
 * recording→transcribing→idle). Used by the overlay's Stop button so the
 * user can stop with the mouse instead of the hotkey.
 *
 * Re-uses the same event the OS-level global shortcut handler fires
 * (`EVT_SHORTCUT_TOGGLE`) so a click in the overlay drives the existing
 * `useHotkeyRecording` state machine in the main window without a new
 * listener — keep the constant centralised in `@/lib/markers` to avoid drift.
 */
export async function requestRecordingToggle(): Promise<void> {
    try {
        await emit(EVT_SHORTCUT_TOGGLE, null);
    } catch (e) {
        console.warn('overlay-bridge: requestRecordingToggle failed', e);
    }
}
