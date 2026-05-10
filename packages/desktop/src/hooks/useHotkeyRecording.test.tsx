import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listenMock, fireEvent } = vi.hoisted(() => {
    type Handler = () => void;
    let handler: Handler | null = null;
    return {
        listenMock: vi.fn(async (_name: string, h: Handler) => {
            handler = h;
            return () => {
                handler = null;
            };
        }),
        fireEvent: () => handler?.(),
    };
});

vi.mock('@tauri-apps/api/event', () => ({
    listen: listenMock,
}));

import type { RecordingDeps } from '@/lib/recording-controller';
import { SHORTCUT_EVENT, useHotkeyRecording } from './useHotkeyRecording';

function makeDeps(): RecordingDeps {
    return {
        vox: {
            startRecording: vi.fn(async () => 'session-1'),
            stopRecording: vi.fn(async () => [82, 73, 70, 70]),
            pasteText: vi.fn(async () => undefined),
            checkMicrophonePermission: vi.fn(async () => 'Granted' as const),
            requestMicrophonePermission: vi.fn(async () => 'Granted' as const),
        },
        transcribe: vi.fn(async () => 'hi'),
    };
}

beforeEach(() => {
    listenMock.mockClear();
});

describe('useHotkeyRecording', () => {
    it('starts in idle and subscribes to the shortcut event', () => {
        const { result } = renderHook(() => useHotkeyRecording({ deps: makeDeps() }));
        expect(result.current.state).toEqual({ kind: 'idle' });
        expect(listenMock).toHaveBeenCalledWith(SHORTCUT_EVENT, expect.any(Function));
    });

    it('toggles idle → recording on first event', async () => {
        const deps = makeDeps();
        const { result } = renderHook(() => useHotkeyRecording({ deps }));
        await act(async () => {
            fireEvent();
        });
        await waitFor(() => {
            expect(result.current.state.kind).toBe('recording');
        });
        expect(deps.vox.startRecording).toHaveBeenCalled();
    });

    it('cycles recording → transcribing → idle on second event', async () => {
        const deps = makeDeps();
        const { result } = renderHook(() => useHotkeyRecording({ deps }));
        await act(async () => {
            fireEvent();
        });
        await waitFor(() => expect(result.current.state.kind).toBe('recording'));

        await act(async () => {
            fireEvent();
        });
        await waitFor(() => expect(result.current.state.kind).toBe('idle'));
        expect(deps.vox.pasteText).toHaveBeenCalledWith('hi');
    });

    it('surfaces errors as error state', async () => {
        const deps = makeDeps();
        vi.mocked(deps.vox.checkMicrophonePermission).mockResolvedValueOnce('Denied');
        const { result } = renderHook(() => useHotkeyRecording({ deps }));
        await act(async () => {
            fireEvent();
        });
        await waitFor(() => expect(result.current.state.kind).toBe('error'));
    });

    it('ignores events fired during transcribing (no double-stop)', async () => {
        // Make transcribe slow so we can fire while in transcribing.
        const deps = makeDeps();
        let resolveTranscribe!: (s: string) => void;
        vi.mocked(deps.transcribe).mockImplementationOnce(
            () =>
                new Promise<string>((res) => {
                    resolveTranscribe = res;
                }),
        );
        const { result } = renderHook(() => useHotkeyRecording({ deps }));
        await act(async () => {
            fireEvent();
        });
        await waitFor(() => expect(result.current.state.kind).toBe('recording'));
        await act(async () => {
            fireEvent();
        });
        await waitFor(() => expect(result.current.state.kind).toBe('transcribing'));

        const stopCallsBefore = vi.mocked(deps.vox.stopRecording).mock.calls.length;
        await act(async () => {
            fireEvent();
        });
        // No additional stop call.
        expect(vi.mocked(deps.vox.stopRecording).mock.calls.length).toBe(stopCallsBefore);

        await act(async () => {
            resolveTranscribe('done');
        });
        await waitFor(() => expect(result.current.state.kind).toBe('idle'));
    });
});
