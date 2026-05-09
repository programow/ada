import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dashboard, type DashboardStats } from './Dashboard';

const stats: DashboardStats = {
    totalWords: 12_345,
    streakDays: 7,
    averageWpm: 142,
    timeSavedMinutes: 96,
    topProvider: 'OpenAI',
    topModel: 'whisper-1',
    estimatedCostUSD: 1.23,
};

describe('<Dashboard />', () => {
    it('renders all stat cards with the supplied values', () => {
        render(<Dashboard stats={stats} />);
        expect(screen.getByTestId('stat-total-words')).toHaveTextContent('12,345');
        expect(screen.getByTestId('stat-streak')).toHaveTextContent('7');
        expect(screen.getByTestId('stat-wpm')).toHaveTextContent('142');
        expect(screen.getByTestId('stat-time-saved')).toHaveTextContent('96');
        expect(screen.getByTestId('stat-top-provider')).toHaveTextContent('OpenAI');
        expect(screen.getByTestId('stat-top-model')).toHaveTextContent('whisper-1');
        expect(screen.getByTestId('stat-cost')).toHaveTextContent('$1.23');
    });

    it('shows a placeholder dash when stats are not yet available', () => {
        render(<Dashboard stats={null} />);
        expect(screen.getByTestId('stat-total-words')).toHaveTextContent('—');
        expect(screen.getByTestId('stat-top-provider')).toHaveTextContent('—');
    });
});
