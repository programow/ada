import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsHistory } from './SettingsHistory';

vi.mock('@/lib/db', () => ({
    getRetentionDays: vi.fn(),
    setRetentionDays: vi.fn(),
    purgeOlderThan: vi.fn(),
    clearAllTranscriptions: vi.fn(),
}));

import {
    clearAllTranscriptions,
    getRetentionDays,
    purgeOlderThan,
    setRetentionDays,
} from '@/lib/db';

beforeEach(() => {
    vi.mocked(getRetentionDays).mockResolvedValue(365);
    vi.mocked(setRetentionDays).mockResolvedValue();
    vi.mocked(purgeOlderThan).mockResolvedValue({ softDeleted: 0, hardDeleted: 0 });
    vi.mocked(clearAllTranscriptions).mockResolvedValue({ deleted: 0 });
});

describe('SettingsHistory', () => {
    it('loads + renders the persisted retention value', async () => {
        vi.mocked(getRetentionDays).mockResolvedValueOnce(90);
        render(<SettingsHistory />);
        await waitFor(() => {
            const select = screen.getByLabelText(/retain/i) as HTMLSelectElement;
            expect(select.value).toBe('90');
        });
    });

    it('persists + sweeps when changing retention', async () => {
        render(<SettingsHistory />);
        await waitFor(() => screen.getByLabelText(/retain/i));
        fireEvent.change(screen.getByLabelText(/retain/i), { target: { value: '30' } });
        await waitFor(() => {
            expect(setRetentionDays).toHaveBeenCalledWith(30);
            expect(purgeOlderThan).toHaveBeenCalledWith(30);
        });
    });

    it('Clear all opens a confirmation, only clears on confirm', async () => {
        render(<SettingsHistory />);
        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
        // cancel does NOT clear
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(clearAllTranscriptions).not.toHaveBeenCalled();
        // confirm DOES clear
        fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
        await waitFor(() => expect(clearAllTranscriptions).toHaveBeenCalled());
    });
});
