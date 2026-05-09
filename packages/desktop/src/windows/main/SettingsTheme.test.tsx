import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsTheme } from './SettingsTheme';

describe('<SettingsTheme />', () => {
    it('renders theme radio options', () => {
        render(<SettingsTheme />);
        expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
    });

    it('invokes onChange when a theme is picked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<SettingsTheme onChange={onChange} />);
        await user.click(screen.getByLabelText(/dark/i));
        expect(onChange).toHaveBeenCalledWith('dark');
    });
});
