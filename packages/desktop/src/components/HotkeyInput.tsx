import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export interface HotkeyInputProps {
    value: string;
    onChange: (combo: string) => void;
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

export function HotkeyInput({ value, onChange }: HotkeyInputProps) {
    const [capturing, setCapturing] = useState(false);

    useEffect(() => {
        if (!capturing) return;
        function handle(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                setCapturing(false);
                return;
            }
            const combo = formatFromEvent(e);
            if (combo === null) return;
            onChange(combo);
            setCapturing(false);
        }
        window.addEventListener('keydown', handle, true);
        return () => window.removeEventListener('keydown', handle, true);
    }, [capturing, onChange]);

    return (
        <div className="flex items-center gap-2">
            <span
                data-testid="hotkey-display"
                className="inline-flex h-10 min-w-[12rem] items-center border-3 border-border bg-bg px-3 text-sm font-bold uppercase tracking-widest shadow-neo"
            >
                {capturing ? 'Press a key combo…' : value}
            </span>
            <Button onClick={() => setCapturing((v) => !v)}>
                {capturing ? 'Cancel' : 'Capture…'}
            </Button>
        </div>
    );
}
