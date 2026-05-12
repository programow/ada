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
});
