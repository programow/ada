import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

vi.mock('@/lib/db', () => ({
    getHistoryStats: vi.fn(),
}));

import { getHistoryStats } from '@/lib/db';

beforeEach(() => {
    vi.mocked(getHistoryStats).mockResolvedValue({
        totalWords: 1234,
        streakDays: 5,
        avgWPM: 42.5,
        timeSavedMinutes: 12.3,
        topProvider: 'openai',
    });
});

describe('Dashboard', () => {
    it('renders five stat cards from getHistoryStats', async () => {
        render(<Dashboard />);
        await waitFor(() => expect(screen.getByText('1,234')).toBeInTheDocument());
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText(/42\.5/)).toBeInTheDocument();
        expect(screen.getByText(/12\.3/)).toBeInTheDocument();
        expect(screen.getByText('openai')).toBeInTheDocument();
    });

    it('renders — placeholders when stats are null', async () => {
        vi.mocked(getHistoryStats).mockResolvedValueOnce({
            totalWords: 0,
            streakDays: 0,
            avgWPM: null,
            timeSavedMinutes: 0,
            topProvider: null,
        });
        render(<Dashboard />);
        await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
    });
});
