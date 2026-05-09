import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverlayWindow } from './OverlayWindow';

describe('<OverlayWindow />', () => {
    it('renders nothing when state is hidden', () => {
        const { container } = render(<OverlayWindow state={{ kind: 'hidden' }} />);
        expect(container.firstChild).toBeNull();
    });

    it('shows the idle pill with a Record action when state is idle', () => {
        render(<OverlayWindow state={{ kind: 'idle' }} />);
        expect(screen.getByTestId('overlay-pill')).toHaveTextContent(/idle/i);
        expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
    });

    it("shows 'Recording' and a Stop button when state is recording", () => {
        render(<OverlayWindow state={{ kind: 'recording' }} />);
        expect(screen.getByTestId('overlay-pill')).toHaveTextContent(/recording/i);
        expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    it("shows 'Transcribing' when state is transcribing", () => {
        render(<OverlayWindow state={{ kind: 'transcribing' }} />);
        expect(screen.getByTestId('overlay-pill')).toHaveTextContent(/transcribing/i);
    });

    it('shows the transcribed text and a Paste action when state is resultPreview', () => {
        render(<OverlayWindow state={{ kind: 'resultPreview', text: 'Hello world' }} />);
        expect(screen.getByTestId('overlay-pill')).toHaveTextContent(/hello world/i);
        expect(screen.getByRole('button', { name: /paste/i })).toBeInTheDocument();
    });

    it('invokes onRecord when the record button is clicked', async () => {
        const onRecord = vi.fn();
        const user = userEvent.setup();
        render(<OverlayWindow state={{ kind: 'idle' }} onRecord={onRecord} />);
        await user.click(screen.getByRole('button', { name: /record/i }));
        expect(onRecord).toHaveBeenCalledTimes(1);
    });

    it('invokes onStop when the stop button is clicked', async () => {
        const onStop = vi.fn();
        const user = userEvent.setup();
        render(<OverlayWindow state={{ kind: 'recording' }} onStop={onStop} />);
        await user.click(screen.getByRole('button', { name: /stop/i }));
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('invokes onPaste with the result text when the paste button is clicked', async () => {
        const onPaste = vi.fn();
        const user = userEvent.setup();
        render(
            <OverlayWindow
                state={{ kind: 'resultPreview', text: 'Greetings' }}
                onPaste={onPaste}
            />,
        );
        await user.click(screen.getByRole('button', { name: /paste/i }));
        expect(onPaste).toHaveBeenCalledWith('Greetings');
    });
});
