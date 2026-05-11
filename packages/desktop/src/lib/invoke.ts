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
    /**
     * Read the loudest sample amplitude (0..1) observed since the previous
     * call. The Rust side resets the tracked peak on each read, so polling
     * this drives a real-time meter that decays naturally to zero.
     */
    getRecordingLevel: (sessionId: string) => invoke<number>('get_recording_level', { sessionId }),

    registerHotkey: (combo: string) => invoke<string>('register_hotkey', { combo }),
    unregisterHotkey: () => invoke<void>('unregister_hotkey'),

    /** macOS only: read the AppleFnUsageType setting (0..3) or null if unset. */
    getFnUsageType: () => invoke<number | null>('get_fn_usage_type'),
    /** macOS only: write AppleFnUsageType + restart cfprefsd. */
    setFnUsageType: (value: number) => invoke<void>('set_fn_usage_type', { value }),

    getSecret: (secretId: string) => invoke<string | null>('get_secret', { secretId }),
    setSecret: (secretId: string, key: string) => invoke<void>('set_secret', { secretId, key }),
    deleteSecret: (secretId: string) => invoke<void>('delete_secret', { secretId }),

    pasteText: (text: string) => invoke<void>('paste_text', { text }),
};
