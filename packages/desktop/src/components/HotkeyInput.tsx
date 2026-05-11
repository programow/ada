import { Button } from '@/components/ui/button';
import { usePlatform } from '@/lib/use-platform';
import { useEffect, useState } from 'react';

export interface HotkeyInputProps {
    value: string;
    onChange: (combo: string) => void;
    /** Fires when the user clicks Capture; receivers can use this to
     * unregister the OS global shortcut so it doesn't intercept the
     * keydown the user is trying to capture. */
    onCaptureStart?: () => void;
    /** Fires when capture mode ends without a value (Esc / Cancel).
     * Receivers should re-register the previous shortcut. Capture-completion
     * with a new value goes through `onChange` and does NOT fire this. */
    onCaptureCancel?: () => void;
    /** Fires when the user clicks the "Use Fn" button (macOS only).
     * Receivers may need to coordinate with the OS (e.g. flip the macOS
     * "Press 🌐 key to:" setting) before calling `onChange('Fn')`. When this
     * is provided, clicking "Use Fn" only calls this; it does NOT also
     * call `onChange('Fn')` directly — the receiver decides when to commit. */
    onUseFnRequested?: () => void;
}

function formatFromEvent(e: KeyboardEvent): string | null {
    if (e.key === 'Escape') return null;
    const isModifierKey =
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta' ||
        e.key === 'OS';
    if (isModifierKey) return null;
    const parts: string[] = [];
    if (e.metaKey) parts.push('Cmd');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (parts.length === 0) return null;
    parts.push(keyLabel(e));
    return parts.join('+');
}

function keyLabel(e: KeyboardEvent): string {
    if (e.code.startsWith('Key')) return e.code.slice(3);
    if (e.code.startsWith('Digit')) return e.code.slice(5);
    if (e.code.startsWith('Arrow')) return e.code.slice(5);
    if (e.code === 'Space') return 'Space';
    if (e.code === 'Enter') return 'Enter';
    if (e.code === 'Escape') return 'Escape';
    if (e.code === 'Tab') return 'Tab';
    if (e.code === 'Backspace') return 'Backspace';
    if (e.code === 'Delete') return 'Delete';
    if (/^F\d{1,2}$/.test(e.code)) return e.code;
    return e.key.toUpperCase();
}

export function HotkeyInput({
    value,
    onChange,
    onCaptureStart,
    onCaptureCancel,
    onUseFnRequested,
}: HotkeyInputProps) {
    const [capturing, setCapturing] = useState(false);
    const platform = usePlatform();
    // While the first fetch is in flight `platform` is null; treat that as
    // "not macOS" so the Fn-key button stays hidden until we know for sure.
    // The cache is warmed at app launch via the onboarding gate, so this
    // null window is effectively a single tick on first paint.
    const isMac = platform?.os === 'macos';

    useEffect(() => {
        if (!capturing) return;
        function handle(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setCapturing(false);
                onCaptureCancel?.();
                return;
            }
            const combo = formatFromEvent(e);
            if (combo === null) return;
            onChange(combo);
            setCapturing(false);
        }
        window.addEventListener('keydown', handle, true);
        return () => window.removeEventListener('keydown', handle, true);
    }, [capturing, onChange, onCaptureCancel]);

    function toggle() {
        if (capturing) {
            setCapturing(false);
            onCaptureCancel?.();
        } else {
            setCapturing(true);
            onCaptureStart?.();
        }
    }

    return (
        <div className="flex items-center gap-2">
            <span
                data-testid="hotkey-display"
                className="inline-flex h-10 min-w-[12rem] items-center border-3 border-border bg-bg px-3 text-sm font-bold uppercase tracking-widest shadow-neo"
            >
                {capturing ? 'Press a key combo…' : value}
            </span>
            <Button onClick={toggle}>{capturing ? 'Cancel' : 'Capture…'}</Button>
            {isMac && (
                <Button
                    variant="outline"
                    onClick={() => {
                        if (onUseFnRequested) {
                            onUseFnRequested();
                        } else {
                            onChange('Fn');
                        }
                    }}
                    title="Use the macOS Fn key. Requires Accessibility permission."
                >
                    Use Fn
                </Button>
            )}
        </div>
    );
}
