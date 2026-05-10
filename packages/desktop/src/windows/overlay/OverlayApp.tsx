import { type OverlayPosition, getOverlayPosition, setOverlayPosition } from '@/lib/db';
import { RECORDING_STATE_EVENT } from '@/lib/overlay-bridge';
import type { RecordingState } from '@/lib/recording-controller';
import { listen } from '@tauri-apps/api/event';
import { PhysicalPosition, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { type OverlayState, OverlayWindow } from './OverlayWindow';

const OVERLAY_WIDTH = 280;
const OVERLAY_HEIGHT = 64;
const BOTTOM_MARGIN_PX = 80;
const POSITION_SAVE_DEBOUNCE_MS = 400;

function mapToOverlayState(r: RecordingState): OverlayState {
    switch (r.kind) {
        case 'recording':
            return { kind: 'recording' };
        case 'transcribing':
            return { kind: 'transcribing' };
        default:
            return { kind: 'hidden' };
    }
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

export function OverlayApp() {
    const recordingState = useOverlayRecordingState();
    useOverlayInitialPosition();
    useOverlayPositionPersistence();
    return <OverlayWindow state={mapToOverlayState(recordingState)} />;
}
