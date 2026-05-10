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

import { RECORDING_STATE_EVENT, hideOverlayWindow, publishRecordingState } from './overlay-bridge';

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
        await publishRecordingState({ kind: 'recording', sessionId: 'session-1' });
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
            publishRecordingState({ kind: 'recording', sessionId: 's' }),
        ).resolves.not.toThrow();
        expect(emitMock).toHaveBeenCalled();
    });

    it('does not throw if show fails', async () => {
        fakeOverlay.show.mockRejectedValueOnce(new Error('boom'));
        await expect(
            publishRecordingState({ kind: 'recording', sessionId: 's' }),
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
        await publishRecordingState({ kind: 'recording', sessionId: 's' });
        expect(fakeOverlay.show).not.toHaveBeenCalled();
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('hides the overlay window on transcribing (no show)', async () => {
        await publishRecordingState({ kind: 'transcribing' });
        expect(fakeOverlay.show).not.toHaveBeenCalled();
        expect(fakeOverlay.hide).toHaveBeenCalled();
    });

    it('still emits the recording-state event for the main window pill', async () => {
        await publishRecordingState({ kind: 'recording', sessionId: 's' });
        expect(emitMock).toHaveBeenCalled();
    });
});

describe('publishRecordingState (getOverlayEnabled fails)', () => {
    it('falls back to showing on recording', async () => {
        getOverlayEnabledMock.mockRejectedValueOnce(new Error('db boom'));
        await publishRecordingState({ kind: 'recording', sessionId: 's' });
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
