import { cn } from '@/lib/utils';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type OverlayState =
    | { kind: 'hidden' }
    | { kind: 'recording' }
    | { kind: 'transcribing' }
    | { kind: 'positioning' };

export interface OverlayWindowProps {
    state: OverlayState;
    onStop?: () => void;
}

const PILL = cn(
    'fixed bottom-3 left-1/2 -translate-x-1/2',
    'flex items-center gap-2',
    'rounded-full bg-black/55 backdrop-blur-md',
    'pl-1.5 pr-3 py-1.5',
    'ring-1 ring-white/10',
    'select-none text-white',
);

const HANDLE = cn(
    'flex items-center justify-center',
    'cursor-grab active:cursor-grabbing',
    'text-white/70 hover:text-white/95',
    'leading-none',
    'px-1',
);

function startDrag(e: React.MouseEvent<HTMLSpanElement>) {
    if (e.button !== 0) return;
    void getCurrentWindow()
        .startDragging()
        .catch((err) => console.warn('OverlayWindow: startDragging failed', err));
}

function DragHandle() {
    return (
        <span
            className={HANDLE}
            data-testid="overlay-drag-handle"
            data-tauri-drag-region
            onMouseDown={startDrag}
            aria-label="Drag to move overlay"
            title="Drag"
        >
            ⠿
        </span>
    );
}

function RecordingDot() {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse"
        />
    );
}

function Waveform() {
    return (
        <span className="pointer-events-none flex items-end gap-0.5" aria-hidden="true">
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

function StopButton({ onClick }: { onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Stop recording"
            title="Stop"
            className={cn(
                'ml-1 flex h-5 w-5 items-center justify-center rounded-full',
                'bg-white/15 text-white/85',
                'hover:bg-white/25 hover:text-white active:bg-white/35',
                'transition-colors',
            )}
        >
            <span aria-hidden="true" className="block h-2 w-2 rounded-[1px] bg-current" />
        </button>
    );
}

function TranscribingDots() {
    return (
        <span className="pointer-events-none flex items-center gap-1" aria-hidden="true">
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

export function OverlayWindow({ state, onStop }: OverlayWindowProps) {
    if (state.kind === 'hidden') return null;

    if (state.kind === 'recording') {
        return (
            <div className={PILL} data-testid="overlay-pill" data-state="recording">
                <DragHandle />
                <RecordingDot />
                <Waveform />
                <span className="pointer-events-none text-[11px] font-medium tracking-wide">
                    Recording
                </span>
                <StopButton onClick={onStop} />
            </div>
        );
    }

    if (state.kind === 'transcribing') {
        return (
            <div className={PILL} data-testid="overlay-pill" data-state="transcribing">
                <DragHandle />
                <TranscribingDots />
                <span className="pointer-events-none text-[11px] font-medium tracking-wide">
                    Transcribing
                </span>
            </div>
        );
    }

    return (
        <div className={PILL} data-testid="overlay-pill" data-state="positioning">
            <DragHandle />
            <span className="pointer-events-none text-[11px] font-medium tracking-wide">
                Drag to position
            </span>
        </div>
    );
}
