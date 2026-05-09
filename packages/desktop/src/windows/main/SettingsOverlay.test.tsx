import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsOverlay } from './SettingsOverlay';

describe('<SettingsOverlay />', () => {
    it('renders overlay position controls and an enable toggle', () => {
        render(<SettingsOverlay />);
        expect(screen.getByRole('heading', { name: /overlay/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/enable overlay/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
    });
});
