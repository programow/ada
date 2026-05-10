import { invoke } from '@tauri-apps/api/core';

export type PermissionState = 'Granted' | 'Denied' | 'NotDetermined';

export interface AudioDeviceInfo {
    id: string;
    label: string;
    isDefault: boolean;
}

export const vox = {
    checkMicrophonePermission: () => invoke<PermissionState>('check_microphone_permission'),
    requestMicrophonePermission: () => invoke<PermissionState>('request_microphone_permission'),
    checkAccessibilityPermission: () => invoke<PermissionState>('check_accessibility_permission'),
    requestAccessibilityPermission: () => invoke<void>('request_accessibility_permission'),
    openSettingsPanel: (panel: 'microphone' | 'accessibility') =>
        invoke<void>('open_settings_panel', { panel }),

    listAudioInputDevices: () => invoke<AudioDeviceInfo[]>('list_audio_input_devices'),
    startRecording: (deviceId?: string) => invoke<string>('start_recording', { deviceId }),
    stopRecording: (sessionId: string) => invoke<number[]>('stop_recording', { sessionId }),

    registerHotkey: (combo: string) => invoke<string>('register_hotkey', { combo }),
    unregisterHotkey: () => invoke<void>('unregister_hotkey'),

    getSecret: (secretId: string) => invoke<string | null>('get_secret', { secretId }),
    setSecret: (secretId: string, key: string) => invoke<void>('set_secret', { secretId, key }),
    deleteSecret: (secretId: string) => invoke<void>('delete_secret', { secretId }),

    pasteText: (text: string) => invoke<void>('paste_text', { text }),
};
