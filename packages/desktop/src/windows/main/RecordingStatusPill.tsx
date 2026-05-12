import type { RecordingState } from '@/lib/recording-controller';
import { cn } from '@/lib/utils';

interface RecordingStatusPillProps {
    state: RecordingState;
}

const PILL_BASE =
    'inline-flex items-center gap-2 rounded-pill px-4 py-1.5 text-xs font-bold tracking-wider shadow-card';

export function RecordingStatusPill({ state }: RecordingStatusPillProps) {
    if (state.kind === 'idle') {
        return null;
    }

    if (state.kind === 'recording') {
        return (
            <span
                data-testid="status-pill"
                data-state="recording"
                className={cn(PILL_BASE, 'bg-brand-coral text-white')}
            >
                <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 animate-pulse rounded-pill bg-white"
                />
                Recording
            </span>
        );
    }

    if (state.kind === 'transcribing') {
        return (
            <span
                data-testid="status-pill"
                data-state="transcribing"
                className={cn(PILL_BASE, 'bg-brand-yellow/30 text-brand-navy')}
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
            className={cn(PILL_BASE, 'bg-brand-coral text-white')}
        >
            {state.message}
        </span>
    );
}
