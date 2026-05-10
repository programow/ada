import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listenMock, fireEvent, currentMonitorMock, setPositionMock } = vi.hoisted(() => {
    type Handler = (event: { payload: unknown }) => void;
    let handler: Handler | null = null;
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
    };
});

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));
vi.mock('@tauri-apps/api/window', () => ({
    listen: listenMock,
    currentMonitor: currentMonitorMock,
    getCurrentWindow: () => ({ setPosition: setPositionMock }),
    PhysicalPosition: class {
        constructor(
            public x: number,
            public y: number,
        ) {}
    },
}));

import { OverlayApp } from './OverlayApp';

beforeEach(() => {
    listenMock.mockClear();
    currentMonitorMock.mockReset().mockResolvedValue({ size: { width: 1920, height: 1080 } });
    setPositionMock.mockClear();
});

describe('<OverlayApp />', () => {
    it('renders nothing initially (idle → hidden)', () => {
        const { container } = render(<OverlayApp />);
        expect(container).toBeEmptyDOMElement();
    });

    it('positions the window at bottom-center on mount', async () => {
        render(<OverlayApp />);
        await waitFor(() => {
            expect(setPositionMock).toHaveBeenCalledTimes(1);
        });
        const arg = setPositionMock.mock.calls[0]?.[0];
        // 1920 wide → x = (1920 - 280) / 2 = 820
        expect(arg?.x).toBe(820);
        // 1080 tall → y = 1080 - 64 - 80 = 936
        expect(arg?.y).toBe(936);
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

    it('skips positioning if currentMonitor returns null', async () => {
        currentMonitorMock.mockResolvedValueOnce(null);
        render(<OverlayApp />);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(setPositionMock).not.toHaveBeenCalled();
    });
});
