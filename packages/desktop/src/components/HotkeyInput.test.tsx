import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HotkeyInput } from './HotkeyInput';

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
});
