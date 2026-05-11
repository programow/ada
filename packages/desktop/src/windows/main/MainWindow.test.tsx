import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
    listApiKeys: vi.fn(async () => []),
    listModelConfigs: vi.fn(async () => []),
    getActiveModelConfigId: vi.fn(async () => null),
    getOverlayEnabled: vi.fn(async () => true),
    setOverlayEnabled: vi.fn(async () => undefined),
    listTranscriptions: vi.fn(async () => []),
    softDeleteTranscription: vi.fn(async () => undefined),
    restoreTranscription: vi.fn(async () => undefined),
    getSelectedMicDeviceId: vi.fn(async () => null),
    setSelectedMicDeviceId: vi.fn(async () => undefined),
    getHotkeyCombo: vi.fn(async () => 'Cmd+Shift+Space'),
    setHotkeyCombo: vi.fn(async () => undefined),
    getRetentionDays: vi.fn(async () => 365),
    setRetentionDays: vi.fn(async () => undefined),
    purgeOlderThan: vi.fn(async () => ({ softDeleted: 0, hardDeleted: 0 })),
    clearAllTranscriptions: vi.fn(async () => ({ deleted: 0 })),
    getHistoryStats: vi.fn(async () => ({
        totalWords: 0,
        streakDays: 0,
        avgWPM: null,
        timeSavedMinutes: 0,
        topProvider: null,
    })),
}));

vi.mock('@/lib/invoke', () => ({
    vox: {
        listAudioInputDevices: vi.fn(async () => []),
        startRecording: vi.fn(async () => 'session-id'),
        stopRecording: vi.fn(async () => []),
        registerHotkey: vi.fn(async () => 'Cmd+Shift+Space'),
        unregisterHotkey: vi.fn(async () => undefined),
    },
}));

vi.mock('@/lib/overlay-bridge', () => ({
    publishRecordingState: vi.fn(async () => undefined),
    hideOverlayWindow: vi.fn(async () => undefined),
    enterOverlayPositionSetup: vi.fn(async () => undefined),
    exitOverlayPositionSetup: vi.fn(async () => undefined),
    resetOverlayPosition: vi.fn(async () => undefined),
    RECORDING_STATE_EVENT: 'vox-era://recording-state',
    OVERLAY_POSITION_SETUP_OFF_EVENT: 'vox-era://overlay-position-setup-off',
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(async () => () => undefined),
    emit: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
    WebviewWindow: { getByLabel: vi.fn(async () => null) },
}));

vi.mock('@/lib/use-onboarding-gate', () => ({
    useOnboardingGate: vi.fn(() => ({ state: 'show-main', complete: vi.fn() })),
}));

import { useOnboardingGate } from '@/lib/use-onboarding-gate';
import { MainWindow } from './MainWindow';

describe('<MainWindow />', () => {
    it('renders four tab triggers: Dashboard, History, Settings, About', () => {
        render(<MainWindow />);
        expect(screen.getByRole('tab', { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /about/i })).toBeInTheDocument();
    });

    it('shows the Dashboard panel by default', () => {
        render(<MainWindow />);
        const dashboardTab = screen.getByRole('tab', { name: /dashboard/i });
        expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('panel-dashboard')).toBeInTheDocument();
    });

    it('switches to the History panel when its tab is clicked', async () => {
        const user = userEvent.setup();
        render(<MainWindow />);
        await user.click(screen.getByRole('tab', { name: /history/i }));
        expect(screen.getByTestId('panel-history')).toBeInTheDocument();
    });

    it('switches to the Settings panel when its tab is clicked', async () => {
        const user = userEvent.setup();
        render(<MainWindow />);
        await user.click(screen.getByRole('tab', { name: /settings/i }));
        expect(screen.getByTestId('panel-settings')).toBeInTheDocument();
    });

    it('switches to the About panel when its tab is clicked', async () => {
        const user = userEvent.setup();
        render(<MainWindow />);
        await user.click(screen.getByRole('tab', { name: /about/i }));
        expect(screen.getByTestId('panel-about')).toBeInTheDocument();
    });

    it('renders a loading state while the onboarding gate is undecided', () => {
        vi.mocked(useOnboardingGate).mockReturnValueOnce({
            state: 'loading',
            complete: vi.fn(),
        });
        render(<MainWindow />);
        expect(screen.getByTestId('main-loading')).toBeInTheDocument();
    });

    it('renders the OnboardingScreen when the gate says show-onboarding', () => {
        vi.mocked(useOnboardingGate).mockReturnValueOnce({
            state: 'show-onboarding',
            complete: vi.fn(),
        });
        render(<MainWindow />);
        // The onboarding screen starts in its own loading state until
        // useOnboardingStatus resolves; either container is acceptable.
        const onboarding =
            screen.queryByTestId('onboarding-screen') ?? screen.queryByTestId('onboarding-loading');
        expect(onboarding).toBeInTheDocument();
    });
});
