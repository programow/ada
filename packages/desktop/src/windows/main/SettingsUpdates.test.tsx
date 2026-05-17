import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsUpdates } from './SettingsUpdates';

describe('<SettingsUpdates />', () => {
    it('renders an auto-update toggle and check-now button', () => {
        render(<SettingsUpdates />);
        expect(screen.getByLabelText(/auto-update/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /check now/i })).toBeInTheDocument();
    });

    it('invokes onCheckNow when the button is clicked', async () => {
        const onCheckNow = vi.fn();
        const user = userEvent.setup();
        render(<SettingsUpdates onCheckNow={onCheckNow} />);
        await user.click(screen.getByRole('button', { name: /check now/i }));
        expect(onCheckNow).toHaveBeenCalledTimes(1);
    });

    it('disables the button and shows "Checking…" while a check is in flight', () => {
        render(<SettingsUpdates status={{ kind: 'checking' }} />);
        const btn = screen.getByRole('button', { name: /checking/i });
        expect(btn).toBeDisabled();
    });

    it('renders an available version in the status line', () => {
        render(<SettingsUpdates status={{ kind: 'available', version: '0.2.0' }} />);
        expect(screen.getByTestId('updates-status-line')).toHaveTextContent(
            /update 0\.2\.0 is ready to install/i,
        );
    });

    it('renders an error message in the status line', () => {
        render(<SettingsUpdates status={{ kind: 'error', message: 'manifest 404' }} />);
        expect(screen.getByTestId('updates-status-line')).toHaveTextContent(/manifest 404/i);
    });
});
