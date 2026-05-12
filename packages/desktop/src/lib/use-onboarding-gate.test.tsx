import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/invoke', () => ({
    vox: {
        getPlatformInfo: vi.fn(),
        checkMicrophonePermission: vi.fn(),
        checkAccessibilityPermission: vi.fn(),
        checkInputMonitoringPermission: vi.fn(),
    },
}));

vi.mock('@/lib/onboarding', () => ({
    isOnboardingCompleted: vi.fn(),
    markOnboardingCompleted: vi.fn(async () => undefined),
}));

import { vox } from '@/lib/invoke';
import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding';
import { useOnboardingGate } from './use-onboarding-gate';

function Harness() {
    const { state } = useOnboardingGate();
    return <div data-testid="state">{state}</div>;
}

beforeEach(() => {
    vi.mocked(isOnboardingCompleted).mockReset();
    vi.mocked(markOnboardingCompleted).mockReset();
    vi.mocked(markOnboardingCompleted).mockResolvedValue(undefined);
    vi.mocked(vox.getPlatformInfo).mockReset();
    vi.mocked(vox.checkMicrophonePermission).mockReset();
    vi.mocked(vox.checkAccessibilityPermission).mockReset();
    vi.mocked(vox.checkInputMonitoringPermission).mockReset();
});

describe('useOnboardingGate', () => {
    it('routes to show-main when onboarding was previously completed', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(true);
        render(<Harness />);
        await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('show-main'));
        expect(vox.getPlatformInfo).not.toHaveBeenCalled();
    });

    it('silently marks completion and routes to show-main when all required perms are already Granted', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(false);
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'windows', isWayland: false });
        vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Granted');

        render(<Harness />);

        await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('show-main'));
        expect(markOnboardingCompleted).toHaveBeenCalledTimes(1);
    });

    it('routes to show-onboarding when a required permission is missing', async () => {
        vi.mocked(isOnboardingCompleted).mockResolvedValue(false);
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'macos', isWayland: false });
        vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Granted');
        vi.mocked(vox.checkAccessibilityPermission).mockResolvedValue('Denied');
        vi.mocked(vox.checkInputMonitoringPermission).mockResolvedValue('Granted');

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
