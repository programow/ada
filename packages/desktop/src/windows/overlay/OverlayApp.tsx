import { RECORDING_STATE_EVENT } from '@/lib/overlay-bridge';
import type { RecordingState } from '@/lib/recording-controller';
import { listen } from '@tauri-apps/api/event';
import { PhysicalPosition, currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { type OverlayState, OverlayWindow } from './OverlayWindow';

const OVERLAY_WIDTH = 280;
const OVERLAY_HEIGHT = 64;
const BOTTOM_MARGIN_PX = 80;

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

function useOverlayInitialPosition(): void {
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const monitor = await currentMonitor();
                if (cancelled || !monitor) return;
                const x = Math.round((monitor.size.width - OVERLAY_WIDTH) / 2);
                const y = monitor.size.height - OVERLAY_HEIGHT - BOTTOM_MARGIN_PX;
                await getCurrentWindow().setPosition(new PhysicalPosition(x, y));
            } catch (e) {
                console.warn('OverlayApp: setPosition failed', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
}

export function OverlayApp() {
    const recordingState = useOverlayRecordingState();
    useOverlayInitialPosition();
    return <OverlayWindow state={mapToOverlayState(recordingState)} />;
}
