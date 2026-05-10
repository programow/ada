import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    listenMock,
    fireEvent,
    currentMonitorMock,
    setPositionMock,
    onMovedMock,
    fireMoved,
    getOverlayPositionMock,
    setOverlayPositionMock,
} = vi.hoisted(() => {
    type Handler = (event: { payload: unknown }) => void;
    let handler: Handler | null = null;
    let movedHandler: ((e: { payload: { x: number; y: number } }) => void) | null = null;
    return {
        listenMock: vi.fn(async (_name: string, h: Handler) => {
            handler = h;
            return () => {
                handler = null;
            };
        }),
        fireEvent: (payload: unknown) => handler?.({ payload }),
        currentMonitorMock: vi.fn<
            () => Promise<{ size: { width: number; height: number } } | null>
        >(async () => ({ size: { width: 1920, height: 1080 } })),
        setPositionMock: vi.fn<(p: { x: number; y: number }) => Promise<void>>(
            async () => undefined,
        ),
        onMovedMock: vi.fn(async (h: (e: { payload: { x: number; y: number } }) => void) => {
            movedHandler = h;
            return () => {
                movedHandler = null;
            };
        }),
        fireMoved: (x: number, y: number) => movedHandler?.({ payload: { x, y } }),
        getOverlayPositionMock: vi.fn<() => Promise<{ x: number; y: number } | null>>(
            async () => null,
        ),
        setOverlayPositionMock: vi.fn<(p: { x: number; y: number }) => Promise<void>>(
            async () => undefined,
        ),
    };
});

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));
vi.mock('@tauri-apps/api/window', () => ({
    listen: listenMock,
    currentMonitor: currentMonitorMock,
    getCurrentWindow: () => ({
        setPosition: setPositionMock,
        onMoved: onMovedMock,
    }),
    PhysicalPosition: class {
        constructor(
            public x: number,
            public y: number,
        ) {}
    },
}));
vi.mock('@/lib/db', () => ({
    getOverlayPosition: getOverlayPositionMock,
    setOverlayPosition: setOverlayPositionMock,
}));

import { OverlayApp } from './OverlayApp';

beforeEach(() => {
    listenMock.mockClear();
    currentMonitorMock.mockReset().mockResolvedValue({ size: { width: 1920, height: 1080 } });
    setPositionMock.mockClear();
    onMovedMock.mockClear();
    getOverlayPositionMock.mockReset().mockResolvedValue(null);
    setOverlayPositionMock.mockReset().mockResolvedValue(undefined);
    vi.useRealTimers();
});

describe('<OverlayApp />', () => {
    it('renders nothing initially (idle → hidden)', () => {
        const { container } = render(<OverlayApp />);
        expect(container).toBeEmptyDOMElement();
    });

    it('positions the window at bottom-center on mount when no saved position', async () => {
        render(<OverlayApp />);
        await waitFor(() => {
            expect(setPositionMock).toHaveBeenCalledTimes(1);
        });
        const arg = setPositionMock.mock.calls[0]?.[0];
        expect(arg?.x).toBe(820);
        expect(arg?.y).toBe(936);
    });

    it('restores the saved position on mount', async () => {
        getOverlayPositionMock.mockResolvedValueOnce({ x: 50, y: 60 });
        render(<OverlayApp />);
        await waitFor(() => {
            expect(setPositionMock).toHaveBeenCalledTimes(1);
        });
        const arg = setPositionMock.mock.calls[0]?.[0];
        expect(arg?.x).toBe(50);
        expect(arg?.y).toBe(60);
        // currentMonitor not consulted when saved exists
        expect(currentMonitorMock).not.toHaveBeenCalled();
    });

    it('renders the recording pill on a recording event', async () => {
        render(<OverlayApp />);
        await waitFor(() => expect(listenMock).toHaveBeenCalled());
        await act(async () => {
            fireEvent({ kind: 'recording', sessionId: 'session-1' });
        });
        const pill = await screen.findByTestId('overlay-pill');
        expect(pill).toHaveTextContent(/recording/i);
    });

    it('renders the transcribing pill on a transcribing event', async () => {
        render(<OverlayApp />);
        await waitFor(() => expect(listenMock).toHaveBeenCalled());
        await act(async () => {
            fireEvent({ kind: 'transcribing' });
        });
        const pill = await screen.findByTestId('overlay-pill');
        expect(pill).toHaveTextContent(/transcrib/i);
    });

    it('hides on idle event', async () => {
        const { container } = render(<OverlayApp />);
        await waitFor(() => expect(listenMock).toHaveBeenCalled());
        await act(async () => {
            fireEvent({ kind: 'recording', sessionId: 'session-1' });
        });
        await screen.findByTestId('overlay-pill');
        await act(async () => {
            fireEvent({ kind: 'idle' });
        });
        await waitFor(() => {
            expect(container.querySelector('[data-testid="overlay-pill"]')).toBeNull();
        });
    });

    it('hides on error event', async () => {
        const { container } = render(<OverlayApp />);
        await waitFor(() => expect(listenMock).toHaveBeenCalled());
        await act(async () => {
            fireEvent({ kind: 'recording', sessionId: 'session-1' });
        });
        await screen.findByTestId('overlay-pill');
        await act(async () => {
            fireEvent({ kind: 'error', message: 'boom' });
        });
        await waitFor(() => {
            expect(container.querySelector('[data-testid="overlay-pill"]')).toBeNull();
        });
    });

    it('skips positioning if currentMonitor returns null and no saved position', async () => {
        currentMonitorMock.mockResolvedValueOnce(null);
        render(<OverlayApp />);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(setPositionMock).not.toHaveBeenCalled();
    });

    it('persists the position on move (after debounce)', async () => {
        render(<OverlayApp />);
        await waitFor(() => expect(onMovedMock).toHaveBeenCalled());
        vi.useFakeTimers();
        act(() => {
            fireMoved(200, 300);
        });
        expect(setOverlayPositionMock).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(401);
        });
        expect(setOverlayPositionMock).toHaveBeenCalledTimes(1);
        expect(setOverlayPositionMock).toHaveBeenCalledWith({ x: 200, y: 300 });
    });

    it('debounces multiple rapid move events into one save with the last position', async () => {
        render(<OverlayApp />);
        await waitFor(() => expect(onMovedMock).toHaveBeenCalled());
        vi.useFakeTimers();
        act(() => {
            fireMoved(100, 100);
            fireMoved(150, 150);
            fireMoved(200, 200);
            fireMoved(250, 250);
            fireMoved(300, 300);
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(401);
        });
        expect(setOverlayPositionMock).toHaveBeenCalledTimes(1);
        expect(setOverlayPositionMock).toHaveBeenCalledWith({ x: 300, y: 300 });
    });

    it('cancels the pending save when unmounted before the debounce fires', async () => {
        const { unmount } = render(<OverlayApp />);
        await waitFor(() => expect(onMovedMock).toHaveBeenCalled());
        vi.useFakeTimers();
        act(() => {
            fireMoved(200, 300);
        });
        unmount();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(setOverlayPositionMock).not.toHaveBeenCalled();
    });
});
