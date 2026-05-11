import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsRecording } from './SettingsRecording';

vi.mock('@/lib/invoke', () => ({
    vox: {
        listAudioInputDevices: vi.fn(),
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        registerHotkey: vi.fn(),
        getPlatformInfo: vi.fn(async () => ({ os: 'macos', isWayland: false })),
    },
}));
vi.mock('@/lib/db', () => ({
    getSelectedMicDeviceId: vi.fn(),
    setSelectedMicDeviceId: vi.fn(),
    getHotkeyCombo: vi.fn(),
    setHotkeyCombo: vi.fn(),
}));

import {
    getHotkeyCombo,
    getSelectedMicDeviceId,
    setHotkeyCombo,
    setSelectedMicDeviceId,
} from '@/lib/db';
import { vox } from '@/lib/invoke';

const voxMock = vi.mocked(vox);
const getSelectedMicDeviceIdMock = vi.mocked(getSelectedMicDeviceId);
const setSelectedMicDeviceIdMock = vi.mocked(setSelectedMicDeviceId);
const getHotkeyComboMock = vi.mocked(getHotkeyCombo);
const setHotkeyComboMock = vi.mocked(setHotkeyCombo);

beforeEach(() => {
    voxMock.listAudioInputDevices.mockResolvedValue([
        { id: 'usb', label: 'USB Mic', isDefault: false },
        { id: 'builtin', label: 'Built-in', isDefault: true },
    ]);
    voxMock.registerHotkey.mockResolvedValue('Cmd+Shift+Space');
    getSelectedMicDeviceIdMock.mockResolvedValue(null);
    getHotkeyComboMock.mockResolvedValue('Cmd+Shift+Space');
    setSelectedMicDeviceIdMock.mockResolvedValue();
    setHotkeyComboMock.mockResolvedValue();
});

describe('SettingsRecording', () => {
    it('loads + renders the device list with System default first', async () => {
        render(<SettingsRecording />);
        await waitFor(() => {
            expect(screen.getByLabelText(/microphone/i)).toBeInTheDocument();
        });
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        expect(select.options[0]?.textContent).toMatch(/system default/i);
        expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
            'System default',
            'USB Mic',
            'Built-in',
        ]);
    });

    it('persists the selected mic on change', async () => {
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'usb' } });
        await waitFor(() => {
            expect(setSelectedMicDeviceIdMock).toHaveBeenCalledWith('usb');
        });
    });

    it('persists null when System default is chosen', async () => {
        getSelectedMicDeviceIdMock.mockResolvedValueOnce('usb');
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => {
            expect(setSelectedMicDeviceIdMock).toHaveBeenCalledWith(null);
        });
    });

    it('persists + registers a new hotkey when the user captures one', async () => {
        render(<SettingsRecording />);
        await waitFor(() => screen.getByLabelText(/microphone/i));
        fireEvent.click(screen.getByRole('button', { name: /capture/i }));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'A', code: 'KeyA', metaKey: true, shiftKey: true }),
        );
        await waitFor(() => {
            expect(setHotkeyComboMock).toHaveBeenCalledWith('Cmd+Shift+A');
            expect(voxMock.registerHotkey).toHaveBeenCalledWith('Cmd+Shift+A');
        });
    });
});
