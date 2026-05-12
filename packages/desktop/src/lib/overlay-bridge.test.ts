import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emitMock, getByLabelMock, fakeOverlay, getOverlayEnabledMock } = vi.hoisted(() => {
    const fakeOverlay = {
        show: vi.fn(async () => undefined),
        hide: vi.fn(async () => undefined),
    };
    return {
        emitMock: vi.fn(async () => undefined),
        getByLabelMock: vi.fn(async (_label: string) => fakeOverlay as unknown),
        fakeOverlay,
        getOverlayEnabledMock: vi.fn(async () => true),
    };
});

vi.mock('@tauri-apps/api/event', () => ({ emit: emitMock }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
    WebviewWindow: { getByLabel: getByLabelMock },
}));
vi.mock('./db', () => ({ getOverlayEnabled: getOverlayEnabledMock }));

import { EVT_SHORTCUT_CANCEL, EVT_SHORTCUT_TOGGLE } from './markers';
import {
    OVERLAY_POSITION_SETUP_OFF_EVENT,
    OVERLAY_POSITION_SETUP_ON_EVENT,
    OVERLAY_RESET_POSITION_EVENT,
    RECORDING_STATE_EVENT,
    enterOverlayPositionSetup,
    exitOverlayPositionSetup,
    hideOverlayWindow,
    publishRecordingState,
    requestRecordingCancel,
    requestRecordingToggle,
    resetOverlayPosition,
} from './overlay-bridge';

beforeEach(() => {
    emitMock.mockClear();
    getByLabelMock.mockReset().mockResolvedValue(fakeOverlay);
    fakeOverlay.show.mockClear();
    fakeOverlay.hide.mockClear();
    getOverlayEnabledMock.mockReset().mockResolvedValue(true);
});

describe('publishRecordingState (overlay enabled)', () => {
    it('emits the recording-state event with the payload', async () => {
        await publishRecordingState({ kind: 'idle' });
        expect(emitMock).toHaveBeenCalledWith(RECORDING_STATE_EVENT, { kind: 'idle' });
    });

    it('shows the overlay window on recording', async () => {
        await publishRecordingState({ kind: 'recording', sessionId: 'session-1', startedAt: 0 });
        expect(getByLabelMock).toHaveBeenCalledWith('overlay');
        expect(fakeOverlay.show).toHaveBeenCalled();
        expect(fakeOverlay.hide).not.toHaveBeenCalled();
    });

    it('shows the overlay window on transcribing', async () => {
        await publishRecordingState({ kind: 'transcribing' });
        expect(fakeOverlay.show).toHaveBeenCalled();
        expect(fakeOverlay.hide).not.toHaveBeenCalled();
    });

    it('hides the overlay window on idle', async () => {
        await publishRecordingState({ kind: 'idle' });
        expect(fakeOverlay.hide).toHaveBeenCalled();
        expect(fakeOverlay.show).not.toHaveBeenCalled();
    });

    it('hides the overlay window on error', async () => {
        await publishRecordingState({ kind: 'error', message: 'boom' });
        expect(fakeOverlay.hide).toHaveBeenCalled();
        expect(fakeOverlay.show).not.toHaveBeenCalled();
    });

    it('does not throw if the overlay window is not registered', async () => {
        getByLabelMock.mockResolvedValueOnce(null);
        await expect(
            publishRecordingState({ kind: 'recording', sessionId: 's', startedAt: 0 }),
        ).resolves.not.toThrow();
        expect(emitMock).toHaveBeenCalled();
    });

    it('does not throw if show fails', async () => {
        fakeOverlay.show.mockRejectedValueOnce(new Error('boom'));
        await expect(
            publishRecordingState({ kind: 'recording', sessionId: 's', startedAt: 0 }),
        ).resolves.not.toThrow();
    });

    it('does not throw if hide fails', async () => {
        fakeOverlay.hide.mockRejectedValueOnce(new Error('boom'));
        await expect(publishRecordingState({ kind: 'idle' })).resolves.not.toThrow();
    });
});

describe('publishRecordingState (overlay disabled)', () => {
    beforeEach(() => {
        getOverlayEnabledMock.mockResolvedValue(false);
    });

    it('hides the overlay window on recording (no show)', async () => {
        await publishRecordingState({ kind: 'recording', sessionId: 's', startedAt: 0 });
        expect(fakeOverlay.show).not.toHaveBeenCalled();
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('hides the overlay window on transcribing (no show)', async () => {
        await publishRecordingState({ kind: 'transcribing' });
        expect(fakeOverlay.show).not.toHaveBeenCalled();
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('still emits the recording-state event for the main window pill', async () => {
        await publishRecordingState({ kind: 'recording', sessionId: 's', startedAt: 0 });
        expect(emitMock).toHaveBeenCalled();
    });
});

describe('publishRecordingState (getOverlayEnabled fails)', () => {
    it('falls back to showing on recording', async () => {
        getOverlayEnabledMock.mockRejectedValueOnce(new Error('db boom'));
        await publishRecordingState({ kind: 'recording', sessionId: 's', startedAt: 0 });
        expect(fakeOverlay.show).toHaveBeenCalled();
    });
});

describe('hideOverlayWindow', () => {
    it('calls overlay.hide()', async () => {
        await hideOverlayWindow();
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('does not throw if overlay is missing', async () => {
        getByLabelMock.mockResolvedValueOnce(null);
        await expect(hideOverlayWindow()).resolves.not.toThrow();
    });

    it('does not throw if hide fails', async () => {
        fakeOverlay.hide.mockRejectedValueOnce(new Error('boom'));
        await expect(hideOverlayWindow()).resolves.not.toThrow();
    });
});

describe('enterOverlayPositionSetup', () => {
    it('emits setup-on and shows the overlay', async () => {
        await enterOverlayPositionSetup();
        expect(emitMock).toHaveBeenCalledWith(OVERLAY_POSITION_SETUP_ON_EVENT, null);
        expect(fakeOverlay.show).toHaveBeenCalled();
    });

    it('does not throw if show fails', async () => {
        fakeOverlay.show.mockRejectedValueOnce(new Error('boom'));
        await expect(enterOverlayPositionSetup()).resolves.not.toThrow();
    });
});

describe('exitOverlayPositionSetup', () => {
    it('emits setup-off (default reason "manual") and hides by default', async () => {
        await exitOverlayPositionSetup();
        expect(emitMock).toHaveBeenCalledWith(OVERLAY_POSITION_SETUP_OFF_EVENT, {
            reason: 'manual',
        });
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('emits setup-off with the supplied reason', async () => {
        await exitOverlayPositionSetup({ hide: true, reason: 'idle' });
        expect(emitMock).toHaveBeenCalledWith(OVERLAY_POSITION_SETUP_OFF_EVENT, {
            reason: 'idle',
        });
    });

    it('emits setup-off but does not hide when hide:false', async () => {
        await exitOverlayPositionSetup({ hide: false, reason: 'recording-wins' });
        expect(emitMock).toHaveBeenCalledWith(OVERLAY_POSITION_SETUP_OFF_EVENT, {
            reason: 'recording-wins',
        });
        expect(fakeOverlay.hide).not.toHaveBeenCalled();
    });

    it('does not throw if emit fails', async () => {
        emitMock.mockRejectedValueOnce(new Error('boom'));
        await expect(exitOverlayPositionSetup()).resolves.not.toThrow();
    });
});

describe('resetOverlayPosition', () => {
    it('emits the reset event', async () => {
        await resetOverlayPosition();
        expect(emitMock).toHaveBeenCalledWith(OVERLAY_RESET_POSITION_EVENT, null);
    });

    it('does not throw if emit fails', async () => {
        emitMock.mockRejectedValueOnce(new Error('boom'));
        await expect(resetOverlayPosition()).resolves.not.toThrow();
    });
});

describe('requestRecordingToggle', () => {
    it('emits the same event the OS hotkey fires', async () => {
        await requestRecordingToggle();
        expect(emitMock).toHaveBeenCalledWith(EVT_SHORTCUT_TOGGLE, null);
    });

    it('does not throw if emit fails', async () => {
        emitMock.mockRejectedValueOnce(new Error('boom'));
        await expect(requestRecordingToggle()).resolves.not.toThrow();
    });
});

describe('requestRecordingCancel', () => {
    it('emits the same event the cancel hotkey fires', async () => {
        await requestRecordingCancel();
        expect(emitMock).toHaveBeenCalledWith(EVT_SHORTCUT_CANCEL, null);
    });

    it('does not throw if emit fails', async () => {
        emitMock.mockRejectedValueOnce(new Error('boom'));
        await expect(requestRecordingCancel()).resolves.not.toThrow();
    });
});
