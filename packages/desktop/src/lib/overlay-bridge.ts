import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getOverlayEnabled } from './db';
import type { RecordingState } from './recording-controller';

export const RECORDING_STATE_EVENT = 'vox-era://recording-state';

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
