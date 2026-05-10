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
