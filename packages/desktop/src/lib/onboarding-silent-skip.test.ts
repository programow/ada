import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/invoke', () => ({
    vox: {
        getPlatformInfo: vi.fn(),
        checkMicrophonePermission: vi.fn(),
        checkAccessibilityPermission: vi.fn(),
        checkInputMonitoringPermission: vi.fn(),
    },
}));

vi.mock('@/lib/db', () => ({
    listApiKeys: vi.fn(),
    listModelConfigs: vi.fn(),
    getHotkeysOnboarded: vi.fn(),
}));

import { getHotkeysOnboarded, listApiKeys, listModelConfigs } from '@/lib/db';
import { vox } from '@/lib/invoke';
import {
    hasAllPermissionsSet,
    hasApiKeySet,
    hasHotkeysConfigured,
    hasModelConfigSet,
    shouldSilentSkip,
} from './onboarding-silent-skip';

function apiKeyStub() {
    return {
        id: 'key-1',
        providerId: 'assemblyai',
        nickname: 'Personal',
        createdAt: '2026-05-15T00:00:00Z',
    };
}

function modelConfigStub() {
    return {
        id: 'mc-1',
        apiKeyId: 'key-1',
        modelId: 'best',
        providerId: 'assemblyai',
        apiKeyNickname: 'Personal',
    };
}

function defaultMocks() {
    vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'macos', isWayland: false });
    vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Granted');
    vi.mocked(vox.checkAccessibilityPermission).mockResolvedValue('Granted');
    vi.mocked(vox.checkInputMonitoringPermission).mockResolvedValue('Granted');
    vi.mocked(listApiKeys).mockResolvedValue([apiKeyStub()]);
    vi.mocked(listModelConfigs).mockResolvedValue([modelConfigStub()]);
    vi.mocked(getHotkeysOnboarded).mockResolvedValue(true);
}

beforeEach(() => {
    vi.mocked(vox.getPlatformInfo).mockReset();
    vi.mocked(vox.checkMicrophonePermission).mockReset();
    vi.mocked(vox.checkAccessibilityPermission).mockReset();
    vi.mocked(vox.checkInputMonitoringPermission).mockReset();
    vi.mocked(listApiKeys).mockReset();
    vi.mocked(listModelConfigs).mockReset();
    vi.mocked(getHotkeysOnboarded).mockReset();
});

describe('hasAllPermissionsSet', () => {
    it('returns true when every required permission is granted', async () => {
        defaultMocks();
        await expect(hasAllPermissionsSet()).resolves.toBe(true);
    });

    it('returns false when any required permission is missing', async () => {
        defaultMocks();
        vi.mocked(vox.checkAccessibilityPermission).mockResolvedValue('Denied');
        await expect(hasAllPermissionsSet()).resolves.toBe(false);
    });

    it('returns true on Windows where only microphone is required', async () => {
        defaultMocks();
        vi.mocked(vox.getPlatformInfo).mockResolvedValue({ os: 'windows', isWayland: false });
        await expect(hasAllPermissionsSet()).resolves.toBe(true);
        // AX / Input Monitoring aren't required on Windows
        expect(vox.checkAccessibilityPermission).not.toHaveBeenCalled();
        expect(vox.checkInputMonitoringPermission).not.toHaveBeenCalled();
    });

    it('returns false when the probe throws', async () => {
        vi.mocked(vox.getPlatformInfo).mockRejectedValue(new Error('ipc down'));
        await expect(hasAllPermissionsSet()).resolves.toBe(false);
    });
});

describe('hasHotkeysConfigured', () => {
    it('returns true when the hotkeys_onboarded flag is set', async () => {
        vi.mocked(getHotkeysOnboarded).mockResolvedValue(true);
        await expect(hasHotkeysConfigured()).resolves.toBe(true);
    });

    it('returns false when the flag has never been written', async () => {
        vi.mocked(getHotkeysOnboarded).mockResolvedValue(false);
        await expect(hasHotkeysConfigured()).resolves.toBe(false);
    });

    it('returns false when the db read throws', async () => {
        vi.mocked(getHotkeysOnboarded).mockRejectedValue(new Error('db locked'));
        await expect(hasHotkeysConfigured()).resolves.toBe(false);
    });
});

describe('hasApiKeySet', () => {
    it('returns true when at least one api key row exists', async () => {
        vi.mocked(listApiKeys).mockResolvedValue([apiKeyStub()]);
        await expect(hasApiKeySet()).resolves.toBe(true);
    });

    it('returns false when no api keys exist', async () => {
        vi.mocked(listApiKeys).mockResolvedValue([]);
        await expect(hasApiKeySet()).resolves.toBe(false);
    });

    it('returns false when listApiKeys throws', async () => {
        vi.mocked(listApiKeys).mockRejectedValue(new Error('db locked'));
        await expect(hasApiKeySet()).resolves.toBe(false);
    });
});

describe('hasModelConfigSet', () => {
    it('returns true when at least one model config exists', async () => {
        vi.mocked(listModelConfigs).mockResolvedValue([modelConfigStub()]);
        await expect(hasModelConfigSet()).resolves.toBe(true);
    });

    it('returns false when no model configs exist', async () => {
        vi.mocked(listModelConfigs).mockResolvedValue([]);
        await expect(hasModelConfigSet()).resolves.toBe(false);
    });

    it('returns false when listModelConfigs throws', async () => {
        vi.mocked(listModelConfigs).mockRejectedValue(new Error('db locked'));
        await expect(hasModelConfigSet()).resolves.toBe(false);
    });
});

describe('shouldSilentSkip (composition)', () => {
    it('returns true only when every predicate returns true', async () => {
        defaultMocks();
        await expect(shouldSilentSkip()).resolves.toBe(true);
    });

    it('returns false when permissions are missing', async () => {
        defaultMocks();
        vi.mocked(vox.checkMicrophonePermission).mockResolvedValue('Denied');
        await expect(shouldSilentSkip()).resolves.toBe(false);
    });

    it('returns false when hotkeys have never been onboarded', async () => {
        defaultMocks();
        vi.mocked(getHotkeysOnboarded).mockResolvedValue(false);
        await expect(shouldSilentSkip()).resolves.toBe(false);
    });

    it('returns false when no api keys exist', async () => {
        defaultMocks();
        vi.mocked(listApiKeys).mockResolvedValue([]);
        await expect(shouldSilentSkip()).resolves.toBe(false);
    });

    it('returns false when no model configs exist', async () => {
        defaultMocks();
        vi.mocked(listModelConfigs).mockResolvedValue([]);
        await expect(shouldSilentSkip()).resolves.toBe(false);
    });
});
