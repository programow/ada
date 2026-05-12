import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-platform', () => ({
    usePlatform: vi.fn(),
}));

import { usePlatform } from '@/lib/use-platform';
import { HotkeyInput } from './HotkeyInput';

beforeEach(() => {
    vi.mocked(usePlatform).mockReset();
    vi.mocked(usePlatform).mockReturnValue({ os: 'macos', isWayland: false });
});

describe('HotkeyInput', () => {
    it('renders the current combo when idle', () => {
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={() => {}} />);
        expect(screen.getByText('Cmd+Shift+Space')).toBeInTheDocument();
    });

    it('captures a combo when the user clicks Capture and presses keys', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        // simulate Shift+A
        act(() => {
            window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'A', code: 'KeyA', shiftKey: true }),
            );
        });
        expect(onChange).toHaveBeenCalledWith('Shift+A');
    });

    it('ignores modifier-only key events while capturing', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft' }));
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('Esc cancels capture without firing onChange', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText('Cmd+Shift+Space')).toBeInTheDocument();
    });

    it('refuses combos with no modifier', () => {
        const onChange = vi.fn();
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', code: 'KeyA' }));
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('shows the "Use Fn" button on macOS', () => {
        vi.mocked(usePlatform).mockReturnValue({ os: 'macos', isWayland: false });
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: /use fn/i })).toBeInTheDocument();
    });

    it('hides the "Use Fn" button off macOS', () => {
        vi.mocked(usePlatform).mockReturnValue({ os: 'windows', isWayland: false });
        render(<HotkeyInput value="Ctrl+Shift+Space" onChange={() => {}} />);
        expect(screen.queryByRole('button', { name: /use fn/i })).not.toBeInTheDocument();
    });

    it('hides the "Use Fn" button while platform info is still loading', () => {
        vi.mocked(usePlatform).mockReturnValue(null);
        render(<HotkeyInput value="Cmd+Shift+Space" onChange={() => {}} />);
        expect(screen.queryByRole('button', { name: /use fn/i })).not.toBeInTheDocument();
    });
});
