import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/onboarding', () => ({
    isOnboardingCompleted: vi.fn(),
    markOnboardingCompleted: vi.fn(async () => undefined),
}));

vi.mock('@/lib/onboarding-silent-skip', () => ({
    shouldSilentSkip: vi.fn(),
}));

import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding';
import { shouldSilentSkip } from '@/lib/onboarding-silent-skip';
import { useOnboardingGate } from './use-onboarding-gate';

function Harness() {
    const { state } = useOnboardingGate();
    return <div data-testid="state">{state}</div>;
}

beforeEach(() => {
    vi.mocked(isOnboardingCompleted).mockReset();
    vi.mocked(markOnboardingCompleted).mockReset();
    vi.mocked(markOnboardingCompleted).mockResolvedValue(undefined);
    vi.mocked(shouldSilentSkip).mockReset();
});

describe('useOnboardingGate', () => {
    it('routes to show-main when onboarding was previously completed', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(true);
        render(<Harness />);
        await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('show-main'));
        // The flag short-circuits before we bother probing for silent-skip.
        expect(shouldSilentSkip).not.toHaveBeenCalled();
    });

    it('silently marks completion and routes to show-main when shouldSilentSkip returns true', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(false);
        vi.mocked(shouldSilentSkip).mockResolvedValue(true);

        render(<Harness />);

        await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('show-main'));
        expect(markOnboardingCompleted).toHaveBeenCalledTimes(1);
    });

    it('routes to show-onboarding when shouldSilentSkip returns false', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(false);
        vi.mocked(shouldSilentSkip).mockResolvedValue(false);

        render(<Harness />);

        await waitFor(() =>
            expect(screen.getByTestId('state').textContent).toBe('show-onboarding'),
        );
        expect(markOnboardingCompleted).not.toHaveBeenCalled();
    });

    it('defaults to show-onboarding on unexpected errors', async () => {
        vi.mocked(isOnboardingCompleted).mockRejectedValue(new Error('boom'));
        render(<Harness />);
        await waitFor(() =>
            expect(screen.getByTestId('state').textContent).toBe('show-onboarding'),
        );
    });
});
