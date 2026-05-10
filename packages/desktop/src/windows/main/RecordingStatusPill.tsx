import type { RecordingState } from '@/lib/recording-controller';
import { cn } from '@/lib/utils';

interface RecordingStatusPillProps {
    state: RecordingState;
}

const PILL_BASE =
    'inline-flex items-center gap-2 border-3 border-border px-3 py-1 text-xs font-bold uppercase tracking-widest shadow-neo';

export function RecordingStatusPill({ state }: RecordingStatusPillProps) {
    if (state.kind === 'idle') {
        return null;
    }

    if (state.kind === 'recording') {
        return (
            <span
                data-testid="status-pill"
                data-state="recording"
                className={cn(PILL_BASE, 'bg-red-400 text-fg')}
            >
                <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse bg-fg" />
                Recording
            </span>
        );
    }

    if (state.kind === 'transcribing') {
        return (
            <span
                data-testid="status-pill"
                data-state="transcribing"
                className={cn(PILL_BASE, 'bg-yellow-300 text-fg')}
            >
                Transcribing…
            </span>
        );
    }

    return (
        <span
            data-testid="status-pill"
            data-state="error"
            role="alert"
            className={cn(PILL_BASE, 'bg-red-400 text-fg normal-case')}
        >
            {state.message}
        </span>
    );
}
