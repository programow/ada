import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsHistory } from './SettingsHistory';

describe('<SettingsHistory />', () => {
    it('renders retention input and clear-history button', () => {
        render(<SettingsHistory />);
        expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/retain for/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
    });
});
