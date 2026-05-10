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

    it('renders the positioning pill with a drag prompt', () => {
        render(<OverlayWindow state={{ kind: 'positioning' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).toHaveAttribute('data-state', 'positioning');
        expect(pill).toHaveTextContent(/drag to position/i);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('confines the drag region to the handle, not the whole pill (recording)', () => {
        render(<OverlayWindow state={{ kind: 'recording' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).not.toHaveAttribute('data-tauri-drag-region');
        const handle = screen.getByTestId('overlay-drag-handle');
        expect(handle).toHaveAttribute('data-tauri-drag-region');
        expect(handle.className).toMatch(/cursor-grab/);
    });

    it('confines the drag region to the handle for the transcribing pill', () => {
        render(<OverlayWindow state={{ kind: 'transcribing' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).not.toHaveAttribute('data-tauri-drag-region');
        expect(screen.getByTestId('overlay-drag-handle')).toHaveAttribute('data-tauri-drag-region');
    });

    it('confines the drag region to the handle for the positioning pill', () => {
        render(<OverlayWindow state={{ kind: 'positioning' }} />);
        const pill = screen.getByTestId('overlay-pill');
        expect(pill).not.toHaveAttribute('data-tauri-drag-region');
        expect(screen.getByTestId('overlay-drag-handle')).toHaveAttribute('data-tauri-drag-region');
    });
});
