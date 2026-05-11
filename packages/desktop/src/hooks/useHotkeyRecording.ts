import { vox } from '@/lib/invoke';
import { EVT_SHORTCUT_TOGGLE } from '@/lib/markers';
import { publishRecordingState } from '@/lib/overlay-bridge';
import { type RecordingDeps, type RecordingState, toggle } from '@/lib/recording-controller';
import { transcribe } from '@/lib/transcribe';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';

// Re-exported under the historical name so existing test imports keep working.
// The single source of truth lives in `@/lib/markers` — do not introduce a
// second copy of this string.
export const SHORTCUT_EVENT = EVT_SHORTCUT_TOGGLE;

const defaultDeps: RecordingDeps = { vox, transcribe };

export type PublishFn = (state: RecordingState) => Promise<void>;

export interface UseHotkeyRecordingOptions {
    /** Override deps in tests. */
    deps?: RecordingDeps;
    /** Override the bridge that broadcasts state to the overlay window. */
    publish?: PublishFn;
}

export function useHotkeyRecording(options: UseHotkeyRecordingOptions = {}): {
    state: RecordingState;
} {
    const [state, setState] = useState<RecordingState>({ kind: 'idle' });
    const stateRef = useRef(state);
    stateRef.current = state;

    const deps = options.deps ?? defaultDeps;
    const depsRef = useRef(deps);
    depsRef.current = deps;

    const publish = options.publish ?? publishRecordingState;
    const publishRef = useRef(publish);
    publishRef.current = publish;

    useEffect(() => {
        let cancelled = false;
        const unlistenPromise = listen(SHORTCUT_EVENT, () => {
            void toggle(stateRef.current, depsRef.current, (next) => {
                if (cancelled) return;
                setState(next);
                void publishRef.current(next);
            });
        });
        return () => {
            cancelled = true;
            void unlistenPromise.then((fn) => fn());
        };
    }, []);

    return { state };
}
