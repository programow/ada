import { cn } from '@/lib/utils';

export type OverlayState = { kind: 'hidden' } | { kind: 'recording' } | { kind: 'transcribing' };

export interface OverlayWindowProps {
    state: OverlayState;
}

const PILL = cn(
    'fixed bottom-3 left-1/2 -translate-x-1/2',
    'flex items-center gap-2',
    'rounded-full bg-black/55 backdrop-blur-md',
    'px-3 py-1.5',
    'ring-1 ring-white/10',
    'select-none text-white',
);

function RecordingDot() {
    return (
        <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse"
        />
    );
}

function Waveform() {
    return (
        <span className="flex items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
                <span
                    key={i}
                    className="block w-0.5 rounded-sm bg-white/85 animate-pulse"
                    style={{
                        height: `${5 + ((i * 5) % 8)}px`,
                        animationDelay: `${i * 110}ms`,
                    }}
                />
            ))}
        </span>
    );
}

function TranscribingDots() {
    return (
        <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="block h-1.5 w-1.5 rounded-full bg-white/85 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                />
            ))}
        </span>
    );
}

export function OverlayWindow({ state }: OverlayWindowProps) {
    if (state.kind === 'hidden') return null;

    if (state.kind === 'recording') {
        return (
            <div className={PILL} data-testid="overlay-pill" data-state="recording">
                <RecordingDot />
                <Waveform />
                <span className="text-[11px] font-medium tracking-wide">Recording</span>
            </div>
        );
    }

    return (
        <div className={PILL} data-testid="overlay-pill" data-state="transcribing">
            <TranscribingDots />
            <span className="text-[11px] font-medium tracking-wide">Transcribing</span>
        </div>
    );
}
