import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OverlayState =
    | { kind: 'hidden' }
    | { kind: 'idle' }
    | { kind: 'recording' }
    | { kind: 'transcribing' }
    | { kind: 'resultPreview'; text: string };

export interface OverlayWindowProps {
    state: OverlayState;
    onRecord?: () => void;
    onStop?: () => void;
    onPaste?: (text: string) => void;
}

function Waveform({ active }: { active: boolean }) {
    return (
        <div className="flex items-end gap-0.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
                <span
                    key={i}
                    className={cn(
                        'w-1 bg-main-foreground transition-all',
                        active ? 'animate-pulse' : '',
                    )}
                    style={{ height: `${6 + ((i * 7) % 12)}px` }}
                />
            ))}
        </div>
    );
}

export function OverlayWindow({ state, onRecord, onStop, onPaste }: OverlayWindowProps) {
    if (state.kind === 'hidden') return null;

    const baseClasses =
        'fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 border-3 border-border px-3 py-2 shadow-neo-lg select-none';

    if (state.kind === 'idle') {
        return (
            <div className={cn(baseClasses, 'bg-bg text-fg')} data-testid="overlay-pill">
                <span className="text-xs font-bold uppercase tracking-widest">Idle</span>
                <Button size="sm" onClick={() => onRecord?.()}>
                    Record
                </Button>
            </div>
        );
    }

    if (state.kind === 'recording') {
        return (
            <div className={cn(baseClasses, 'bg-red-400 text-fg')} data-testid="overlay-pill">
                <Waveform active />
                <span className="text-xs font-bold uppercase tracking-widest">Recording</span>
                <Button size="sm" variant="outline" onClick={() => onStop?.()}>
                    Stop
                </Button>
            </div>
        );
    }

    if (state.kind === 'transcribing') {
        return (
            <div
                className={cn(baseClasses, 'bg-main text-main-foreground')}
                data-testid="overlay-pill"
            >
                <Waveform active />
                <span className="text-xs font-bold uppercase tracking-widest">Transcribing</span>
            </div>
        );
    }

    return (
        <div className={cn(baseClasses, 'bg-bg text-fg')} data-testid="overlay-pill">
            <span className="max-w-[200px] truncate text-xs font-bold normal-case">
                {state.text}
            </span>
            <Button size="sm" onClick={() => onPaste?.(state.text)}>
                Paste
            </Button>
        </div>
    );
}
