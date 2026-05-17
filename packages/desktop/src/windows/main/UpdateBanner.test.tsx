import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from './UpdateBanner';

describe('<UpdateBanner />', () => {
    it('renders nothing for idle/checking/up-to-date', () => {
        const onInstall = vi.fn();
        const { rerender } = render(
            <UpdateBanner status={{ kind: 'idle' }} onInstall={onInstall} />,
        );
        expect(screen.queryByRole('status')).toBeNull();
        rerender(<UpdateBanner status={{ kind: 'checking' }} onInstall={onInstall} />);
        expect(screen.queryByRole('status')).toBeNull();
        rerender(<UpdateBanner status={{ kind: 'up-to-date' }} onInstall={onInstall} />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('renders the version and triggers onInstall when "available"', async () => {
        const onInstall = vi.fn();
        const user = userEvent.setup();
        render(
            <UpdateBanner status={{ kind: 'available', version: '0.2.0' }} onInstall={onInstall} />,
        );
        expect(screen.getByText(/update 0\.2\.0 available/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /install/i }));
        expect(onInstall).toHaveBeenCalledTimes(1);
    });

    it('shows a progress percentage when downloading', () => {
        render(
            <UpdateBanner status={{ kind: 'downloading', progress: 0.42 }} onInstall={vi.fn()} />,
        );
        expect(screen.getByText(/42%/)).toBeInTheDocument();
    });

    it('shows an installing message', () => {
        render(<UpdateBanner status={{ kind: 'installing' }} onInstall={vi.fn()} />);
        expect(screen.getByText(/installing/i)).toBeInTheDocument();
    });

    it('shows the error message and dismiss button when given a handler', async () => {
        const onDismiss = vi.fn();
        const user = userEvent.setup();
        render(
            <UpdateBanner
                status={{ kind: 'error', message: 'signature mismatch' }}
                onInstall={vi.fn()}
                onDismissError={onDismiss}
            />,
        );
        expect(screen.getByText(/signature mismatch/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /dismiss/i }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
