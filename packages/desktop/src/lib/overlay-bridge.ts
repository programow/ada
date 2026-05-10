import { emit } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { RecordingState } from './recording-controller';

export const RECORDING_STATE_EVENT = 'vox-era://recording-state';

const OVERLAY_LABEL = 'overlay';

function shouldShowOverlay(state: RecordingState): boolean {
    return state.kind === 'recording' || state.kind === 'transcribing';
}

/**
 * Broadcast a recording state transition to the overlay window: emits a
 * Tauri event the overlay listens for, then shows or hides the overlay's
 * OS window based on the state kind. Side-effect-only and never throws —
 * an overlay quirk must not break the recording flow.
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
        if (shouldShowOverlay(state)) {
            await overlay.show();
        } else {
            await overlay.hide();
        }
    } catch (e) {
        console.warn('overlay-bridge: show/hide failed', e);
    }
}
