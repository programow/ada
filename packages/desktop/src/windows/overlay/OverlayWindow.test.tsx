import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlayWindow } from './OverlayWindow';

describe('<OverlayWindow />', () => {
    it('renders nothing when state is hidden', () => {
        const { container } = render(<OverlayWindow state={{ kind: 'hidden' }} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the recording pill (no buttons)', () => {
        render(<OverlayWindow state={{ kind: 'recording' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).toHaveAttribute('data-state', 'recording');
        expect(pill).toHaveTextContent(/recording/i);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('renders the transcribing pill (no buttons)', () => {
        render(<OverlayWindow state={{ kind: 'transcribing' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).toHaveAttribute('data-state', 'transcribing');
        expect(pill).toHaveTextContent(/transcribing/i);
        expect(screen.queryByRole('button')).toBeNull();
    });
});
