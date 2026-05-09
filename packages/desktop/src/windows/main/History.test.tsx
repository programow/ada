import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { History, type HistoryEntry } from './History';

const entries: HistoryEntry[] = [
    {
        id: '1',
        text: 'Hello world',
        provider: 'OpenAI',
        model: 'whisper-1',
        createdAt: '2026-05-01T10:00:00Z',
    },
    {
        id: '2',
        text: 'Another entry',
        provider: 'Groq',
        model: 'whisper-large-v3',
        createdAt: '2026-05-02T10:00:00Z',
    },
    {
        id: '3',
        text: 'Goodbye moon',
        provider: 'OpenAI',
        model: 'whisper-1',
        createdAt: '2026-05-03T10:00:00Z',
    },
];

describe('<History />', () => {
    it('renders a row per entry by default', () => {
        render(<History entries={entries} pageSize={10} />);
        expect(screen.getAllByTestId('history-row')).toHaveLength(3);
    });

    it('renders an empty-state message when there are no entries', () => {
        render(<History entries={[]} pageSize={10} />);
        expect(screen.getByText(/no transcriptions yet/i)).toBeInTheDocument();
    });

    it('filters by search term across the text field', async () => {
        const user = userEvent.setup();
        render(<History entries={entries} pageSize={10} />);
        await user.type(screen.getByPlaceholderText(/search/i), 'Goodbye');
        const rows = screen.getAllByTestId('history-row');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent(/Goodbye moon/);
    });

    it('filters by provider when a provider is chosen', async () => {
        const user = userEvent.setup();
        render(<History entries={entries} pageSize={10} />);
        await user.selectOptions(screen.getByLabelText(/provider/i), 'Groq');
        const rows = screen.getAllByTestId('history-row');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent(/Another entry/);
    });

    it('paginates when entries exceed the page size', async () => {
        const user = userEvent.setup();
        render(<History entries={entries} pageSize={2} />);
        expect(screen.getAllByTestId('history-row')).toHaveLength(2);
        await user.click(screen.getByRole('button', { name: /next/i }));
        expect(screen.getAllByTestId('history-row')).toHaveLength(1);
    });
});
