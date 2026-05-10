import { type OverlayPosition, getOverlayPosition, setOverlayPosition } from '@/lib/db';
import {
    OVERLAY_POSITION_SETUP_OFF_EVENT,
    OVERLAY_POSITION_SETUP_ON_EVENT,
    OVERLAY_RESET_POSITION_EVENT,
    RECORDING_STATE_EVENT,
    exitOverlayPositionSetup,
    requestRecordingToggle,
} from '@/lib/overlay-bridge';
import type { RecordingState } from '@/lib/recording-controller';
import { listen } from '@tauri-apps/api/event';
import { PhysicalPosition, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef, useState } from 'react';
import { type OverlayState, OverlayWindow } from './OverlayWindow';

const OVERLAY_WIDTH = 280;
const OVERLAY_HEIGHT = 64;
const BOTTOM_MARGIN_PX = 80;
const POSITION_SAVE_DEBOUNCE_MS = 400;
const SETUP_IDLE_EXIT_MS = 3000;

function determineOverlayState(rec: RecordingState, setupActive: boolean): OverlayState {
    if (rec.kind === 'recording') return { kind: 'recording' };
    if (rec.kind === 'transcribing') return { kind: 'transcribing' };
    if (setupActive) return { kind: 'positioning' };
    return { kind: 'hidden' };
}

function useOverlayRecordingState(): RecordingState {
    const [state, setState] = useState<RecordingState>({ kind: 'idle' });
    useEffect(() => {
        let cancelled = false;
        const unlisten = listen<RecordingState>(RECORDING_STATE_EVENT, (event) => {
            if (!cancelled) setState(event.payload);
        });
        return () => {
            cancelled = true;
            void unlisten.then((fn) => fn());
        };
    }, []);
    return state;
}

async function defaultBottomCenter(): Promise<OverlayPosition | null> {
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const x = Math.round((monitor.size.width - OVERLAY_WIDTH) / 2);
    const y = monitor.size.height - OVERLAY_HEIGHT - BOTTOM_MARGIN_PX;
    return { x, y };
}

async function applyDefaultPosition(): Promise<void> {
    const target = await defaultBottomCenter();
    if (!target) return;
    await getCurrentWindow().setPosition(new PhysicalPosition(target.x, target.y));
}

function useOverlayInitialPosition(): void {
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const saved = await getOverlayPosition();
                if (cancelled) return;
                const target = saved ?? (await defaultBottomCenter());
                if (cancelled || !target) return;
                await getCurrentWindow().setPosition(new PhysicalPosition(target.x, target.y));
            } catch (e) {
                console.warn('OverlayApp: setPosition failed', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
}

function useOverlayPositionPersistence(): void {
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let pending: OverlayPosition | null = null;

        const unlistenPromise = getCurrentWindow().onMoved(({ payload }) => {
            if (cancelled) return;
            pending = { x: payload.x, y: payload.y };
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (cancelled || !pending) return;
                const next = pending;
                void setOverlayPosition(next).catch((e) => {
                    console.warn('OverlayApp: setOverlayPosition failed', e);
                });
            }, POSITION_SAVE_DEBOUNCE_MS);
        });

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            void unlistenPromise.then((fn) => fn());
        };
    }, []);
}

function useOverlayResetHandler(): void {
    useEffect(() => {
        let cancelled = false;
        const unlistenP = listen(OVERLAY_RESET_POSITION_EVENT, () => {
            if (cancelled) return;
            void applyDefaultPosition().catch((e) => {
                console.warn('OverlayApp: applyDefaultPosition failed', e);
            });
        });
        return () => {
            cancelled = true;
            void unlistenP.then((fn) => fn());
        };
    }, []);
}

/**
 * Tracks whether the user is currently in "set position" mode (entered via
 * the Settings → Overlay toggle). When active, the overlay renders the
 * positioning pill and a 5-second idle-exit timer runs: the timer arms on
 * the first onMoved event after entering setup and resets on every
 * subsequent onMoved; once it expires, we emit the setup-off event so the
 * main window's UI reverts and the overlay hides.
 *
 * Recording wins: if a recording transition arrives while setup is active,
 * we exit setup (without hiding the window — the recording state is
 * keeping it visible).
 */
function useOverlayPositionSetup(recordingState: RecordingState): { setupActive: boolean } {
    const [setupActive, setSetupActive] = useState(false);
    const setupActiveRef = useRef(setupActive);
    setupActiveRef.current = setupActive;

    useEffect(() => {
        let cancelled = false;
        const onP = listen(OVERLAY_POSITION_SETUP_ON_EVENT, () => {
            if (!cancelled) setSetupActive(true);
        });
        const offP = listen(OVERLAY_POSITION_SETUP_OFF_EVENT, () => {
            if (!cancelled) setSetupActive(false);
        });
        return () => {
            cancelled = true;
            void onP.then((fn) => fn());
            void offP.then((fn) => fn());
        };
    }, []);

    useEffect(() => {
        if (!setupActive) return;
        if (recordingState.kind === 'recording' || recordingState.kind === 'transcribing') {
            void exitOverlayPositionSetup({ hide: false, reason: 'recording-wins' });
        }
    }, [setupActive, recordingState.kind]);

    useEffect(() => {
        if (!setupActive) return;
        let cancelled = false;
        let idleTimer: ReturnType<typeof setTimeout> | null = null;

        const armTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (cancelled) return;
                void exitOverlayPositionSetup({ hide: true, reason: 'idle' });
            }, SETUP_IDLE_EXIT_MS);
        };

        const unlistenP = getCurrentWindow().onMoved(() => {
            if (cancelled) return;
            armTimer();
        });

        return () => {
            cancelled = true;
            if (idleTimer) clearTimeout(idleTimer);
            void unlistenP.then((fn) => fn());
        };
    }, [setupActive]);

    return { setupActive };
}

export function OverlayApp() {
    const recordingState = useOverlayRecordingState();
    const { setupActive } = useOverlayPositionSetup(recordingState);
    useOverlayInitialPosition();
    useOverlayPositionPersistence();
    useOverlayResetHandler();
    return (
        <OverlayWindow
            state={determineOverlayState(recordingState, setupActive)}
            onStop={() => void requestRecordingToggle()}
        />
    );
}
