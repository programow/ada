import * as core from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vox } from './invoke';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('invoke wrapper', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('checkMicrophonePermission delegates to invoke with the snake_case name', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce('Granted');
        const result = await vox.checkMicrophonePermission();
        expect(core.invoke).toHaveBeenCalledWith('check_microphone_permission');
        expect(result).toBe('Granted');
    });

    it('setSecret passes the secret id and key', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce(undefined);
        await vox.setSecret('00000000-0000-0000-0000-000000000001', 'sk-test');
        expect(core.invoke).toHaveBeenCalledWith('set_secret', {
            secretId: '00000000-0000-0000-0000-000000000001',
            key: 'sk-test',
        });
    });
});

describe('vox.listAudioInputDevices', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('invokes list_audio_input_devices with no args', async () => {
        const invoke = vi.mocked(core.invoke);
        invoke.mockResolvedValueOnce([{ id: 'a', label: 'A', isDefault: true }]);
        const result = await vox.listAudioInputDevices();
        expect(invoke).toHaveBeenCalledWith('list_audio_input_devices');
        expect(result).toEqual([{ id: 'a', label: 'A', isDefault: true }]);
    });
});

describe('vox.startRecording', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('passes the device id when supplied', async () => {
        const invoke = vi.mocked(core.invoke);
        invoke.mockResolvedValueOnce('session-1');
        await vox.startRecording('USB Mic');
        expect(invoke).toHaveBeenCalledWith('start_recording', {
            deviceId: 'USB Mic',
        });
    });
    it('passes undefined deviceId when omitted', async () => {
        const invoke = vi.mocked(core.invoke);
        invoke.mockResolvedValueOnce('session-2');
        await vox.startRecording();
        expect(invoke).toHaveBeenCalledWith('start_recording', {
            deviceId: undefined,
        });
    });
});

describe('vox.registerHotkey', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('passes the combo string', async () => {
        const invoke = vi.mocked(core.invoke);
        invoke.mockResolvedValueOnce('Cmd+Shift+Space');
        const formatted = await vox.registerHotkey('cmd+shift+space');
        expect(invoke).toHaveBeenCalledWith('register_hotkey', {
            combo: 'cmd+shift+space',
        });
        expect(formatted).toBe('Cmd+Shift+Space');
    });
});

describe('input monitoring + prompting accessibility wrappers', () => {
    beforeEach(() => {
        vi.mocked(core.invoke).mockReset();
    });

    it('checkInputMonitoringPermission invokes the snake_case command', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce('Denied');
        const result = await vox.checkInputMonitoringPermission();
        expect(core.invoke).toHaveBeenCalledWith('check_input_monitoring_permission');
        expect(result).toBe('Denied');
    });

    it('requestInputMonitoringPermission invokes the snake_case command', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce('Granted');
        const result = await vox.requestInputMonitoringPermission();
        expect(core.invoke).toHaveBeenCalledWith('request_input_monitoring_permission');
        expect(result).toBe('Granted');
    });

    it('checkAccessibilityPermissionPrompting routes to a different command than the non-prompting variant', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce('Granted');
        await vox.checkAccessibilityPermissionPrompting();
        expect(core.invoke).toHaveBeenCalledWith('check_accessibility_permission_prompting');
    });

    it('openSettingsPanel accepts the input-monitoring value', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce(undefined);
        await vox.openSettingsPanel('input-monitoring');
        expect(core.invoke).toHaveBeenCalledWith('open_settings_panel', {
            panel: 'input-monitoring',
        });
    });
});
