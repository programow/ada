import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/invoke', () => ({
    vox: {
        getPlatformInfo: vi.fn(),
        checkMicrophonePermission: vi.fn(),
        checkAccessibilityPermission: vi.fn(),
        checkInputMonitoringPermission: vi.fn(),
    },
}));

import { vox } from '@/lib/invoke';
import { useOnboardingStatus } from './use-onboarding-status';

function Harness() {
    const s = useOnboardingStatus();
    return (
        <div>
            <div data-testid="loading">{String(s.loading)}</div>
            <div data-testid="os">{s.platform?.os ?? '-'}</div>
            <div data-testid="required">{s.permissions?.required.join(',') ?? '-'}</div>
            <div data-testid="allGranted">{String(s.allGranted)}</div>
            <div data-testid="mic">{s.statuses.microphone ?? '-'}</div>
            <div data-testid="ax">{s.statuses.accessibility ?? '-'}</div>
            <div data-testid="input">{s.statuses['input-monitoring'] ?? '-'}</div>
        </div>
    );
}

beforeEach(() => {
    vi.mocked(vox.getPlatformInfo).mockReset();
    vi.mocked(vox.checkMicrophonePermission).mockReset();
    vi.mocked(vox.checkAccessibilityPermission).mockReset();
    vi.mocked(vox.checkInputMonitoringPermission).mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useOnboardingStatus', () => {
    it('on Windows, polls only microphone and reports allGranted when granted', async () => {
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'windows', isWayland: false });
        vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Granted');

        render(<Harness />);

        await waitFor(() => expect(screen.getByTestId('os').textContent).toBe('windows'));
        await waitFor(() => expect(screen.getByTestId('mic').textContent).toBe('Granted'));
        await waitFor(() => expect(screen.getByTestId('allGranted').textContent).toBe('true'));
        expect(vox.checkAccessibilityPermission).not.toHaveBeenCalled();
        expect(vox.checkInputMonitoringPermission).not.toHaveBeenCalled();
    });

    it('on macOS, polls all three permissions and reports allGranted only when every one is granted', async () => {
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'macos', isWayland: false });
        vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Granted');
        vi.mocked(vox.checkAccessibilityPermission).mockResolvedValue('Denied');
        vi.mocked(vox.checkInputMonitoringPermission).mockResolvedValue('Granted');

        render(<Harness />);

        await waitFor(() =>
            expect(screen.getByTestId('required').textContent).toBe(
                'microphone,accessibility,input-monitoring',
            ),
        );
        await waitFor(() => expect(screen.getByTestId('ax').textContent).toBe('Denied'));
        expect(screen.getByTestId('allGranted').textContent).toBe('false');
    });

    it('re-polls so a Denied → Granted transition is observed', async () => {
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'windows', isWayland: false });
        const mic = vi.mocked(vox.checkMicrophonePermission);
        // Stay Denied until the test explicitly flips the mock — the poller
        // would otherwise race past Denied before our assertion fires.
        mic.mockResolvedValue('Denied');

        render(<Harness />);

        await waitFor(() => expect(screen.getByTestId('mic').textContent).toBe('Denied'));

        mic.mockResolvedValue('Granted');
        await waitFor(() => expect(screen.getByTestId('mic').textContent).toBe('Granted'), {
            timeout: 3000,
        });
    });
});
