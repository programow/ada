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

    it('setSecret passes camelCase args translated to snake_case', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce(undefined);
        await vox.setSecret('openai', 'sk-test');
        expect(core.invoke).toHaveBeenCalledWith('set_secret', {
            providerId: 'openai',
            key: 'sk-test',
        });
    });
});
