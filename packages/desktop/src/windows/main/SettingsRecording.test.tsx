import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsRecording } from './SettingsRecording';

const devices = [
    { deviceId: 'default', label: 'Default microphone' },
    { deviceId: 'usb-mic', label: 'USB Microphone' },
];

describe('<SettingsRecording />', () => {
    it('renders a hotkey input, a mic device select, and a test-recording button', () => {
        render(<SettingsRecording devices={devices} />);
        expect(screen.getByLabelText(/hotkey/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/microphone/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /test recording/i })).toBeInTheDocument();
    });

    it('shows a coming-soon badge on the section header', () => {
        render(<SettingsRecording devices={devices} />);
        expect(screen.getByTestId('coming-soon-badge')).toBeInTheDocument();
    });

    it('lists every supplied device in the select', () => {
        render(<SettingsRecording devices={devices} />);
        const select = screen.getByLabelText(/microphone/i) as HTMLSelectElement;
        const labels = Array.from(select.options).map((o) => o.textContent);
        expect(labels).toContain('Default microphone');
        expect(labels).toContain('USB Microphone');
    });

    it('invokes onTestRecording when the test button is clicked', async () => {
        const onTestRecording = vi.fn();
        const user = userEvent.setup();
        render(<SettingsRecording devices={devices} onTestRecording={onTestRecording} />);
        await user.click(screen.getByRole('button', { name: /test recording/i }));
        expect(onTestRecording).toHaveBeenCalledTimes(1);
    });

    it('invokes onHotkeyChange when the hotkey input is updated', async () => {
        const onHotkeyChange = vi.fn();
        const user = userEvent.setup();
        render(
            <SettingsRecording
                devices={devices}
                hotkey="Cmd+Shift+Space"
                onHotkeyChange={onHotkeyChange}
            />,
        );
        const input = screen.getByLabelText(/hotkey/i) as HTMLInputElement;
        await user.clear(input);
        await user.type(input, 'Ctrl+Alt+R');
        expect(onHotkeyChange).toHaveBeenLastCalledWith('Ctrl+Alt+R');
    });
});
