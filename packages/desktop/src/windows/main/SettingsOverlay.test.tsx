import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
    getOverlayEnabled: vi.fn(async () => true),
    setOverlayEnabled: vi.fn(async () => undefined),
}));

vi.mock('@/lib/overlay-bridge', () => ({
    hideOverlayWindow: vi.fn(async () => undefined),
}));

import * as db from '@/lib/db';
import * as bridge from '@/lib/overlay-bridge';
import { SettingsOverlay } from './SettingsOverlay';

beforeEach(() => {
    vi.mocked(db.getOverlayEnabled).mockReset().mockResolvedValue(true);
    vi.mocked(db.setOverlayEnabled).mockReset();
    vi.mocked(bridge.hideOverlayWindow).mockReset();
});

describe('<SettingsOverlay />', () => {
    it('renders the overlay enable toggle', async () => {
        render(<SettingsOverlay />);
        expect(screen.getByRole('heading', { name: /overlay/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/enable overlay/i)).toBeInTheDocument();
    });

    it('reflects the loaded value (default true)', async () => {
        vi.mocked(db.getOverlayEnabled).mockResolvedValueOnce(true);
        render(<SettingsOverlay />);
        const toggle = screen.getByLabelText(/enable overlay/i);
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'true');
            expect(toggle).not.toBeDisabled();
        });
    });

    it('renders unchecked when stored value is false', async () => {
        vi.mocked(db.getOverlayEnabled).mockResolvedValueOnce(false);
        render(<SettingsOverlay />);
        const toggle = screen.getByLabelText(/enable overlay/i);
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'false');
        });
    });

    it('persists and hides overlay when toggled off', async () => {
        vi.mocked(db.getOverlayEnabled).mockResolvedValueOnce(true);
        const user = userEvent.setup();
        render(<SettingsOverlay />);
        const toggle = screen.getByLabelText(/enable overlay/i);
        await waitFor(() => expect(toggle).not.toBeDisabled());
        await user.click(toggle);
        await waitFor(() => {
            expect(db.setOverlayEnabled).toHaveBeenCalledWith(false);
            expect(bridge.hideOverlayWindow).toHaveBeenCalled();
        });
    });

    it('persists when toggled on without calling hideOverlayWindow', async () => {
        vi.mocked(db.getOverlayEnabled).mockResolvedValueOnce(false);
        const user = userEvent.setup();
        render(<SettingsOverlay />);
        const toggle = screen.getByLabelText(/enable overlay/i);
        await waitFor(() => expect(toggle).not.toBeDisabled());
        await user.click(toggle);
        await waitFor(() => {
            expect(db.setOverlayEnabled).toHaveBeenCalledWith(true);
        });
        expect(bridge.hideOverlayWindow).not.toHaveBeenCalled();
    });
});
