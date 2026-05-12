import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecordingStatusPill } from './RecordingStatusPill';

describe('<RecordingStatusPill />', () => {
    it('renders nothing when idle', () => {
        const { container } = render(<RecordingStatusPill state={{ kind: 'idle' }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the Recording pill while recording', () => {
        render(
            <RecordingStatusPill
                state={{ kind: 'recording', sessionId: 'session-1', startedAt: 0 }}
            />,
        );
        const pill = screen.getByTestId('status-pill');
        expect(pill).toHaveAttribute('data-state', 'recording');
        expect(pill).toHaveTextContent(/recording/i);
    });

    it('renders the Transcribing pill while transcribing', () => {
        render(<RecordingStatusPill state={{ kind: 'transcribing' }} />);
        const pill = screen.getByTestId('status-pill');
        expect(pill).toHaveAttribute('data-state', 'transcribing');
        expect(pill).toHaveTextContent(/transcrib/i);
    });

    it('renders the error message in alert role', () => {
        render(<RecordingStatusPill state={{ kind: 'error', message: 'No model selected' }} />);
        const pill = screen.getByTestId('status-pill');
        expect(pill).toHaveAttribute('data-state', 'error');
        expect(pill).toHaveAttribute('role', 'alert');
        expect(pill).toHaveTextContent('No model selected');
    });
});
