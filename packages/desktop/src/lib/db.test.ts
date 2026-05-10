import * as core from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

type ExecResult = { rowsAffected: number; lastInsertId: number };

const fakeDb = {
    execute: vi.fn<(sql: string, params?: unknown[]) => Promise<ExecResult>>(),
    select: vi.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>(),
};

vi.mock('@tauri-apps/plugin-sql', () => ({
    default: { load: vi.fn(async () => fakeDb) },
}));

import {
    addApiKey,
    addModelConfig,
    deleteApiKey,
    deleteModelConfig,
    getActiveModelConfigId,
    getModelConfigWithApiKey,
    getOverlayEnabled,
    getOverlayPosition,
    listApiKeys,
    listModelConfigDependencies,
    listModelConfigs,
    setActiveModelConfigId,
    setOverlayEnabled,
    setOverlayPosition,
} from './db';

beforeEach(() => {
    vi.mocked(core.invoke).mockReset();
    fakeDb.execute.mockReset();
    fakeDb.select.mockReset();
    fakeDb.execute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    vi.mocked(Database.load).mockClear();
});

describe('db.listApiKeys', () => {
    it('selects all api_keys ordered by created_at', async () => {
        fakeDb.select.mockResolvedValueOnce([
            { id: 'a', provider_id: 'openai', nickname: 'Personal', created_at: '2026-05-09' },
        ]);
        const rows = await listApiKeys();
        expect(rows).toEqual([
            { id: 'a', providerId: 'openai', nickname: 'Personal', createdAt: '2026-05-09' },
        ]);
        expect(fakeDb.select).toHaveBeenCalledWith(
            expect.stringMatching(/SELECT .* FROM api_keys/i),
        );
    });
});

describe('db.addApiKey', () => {
    it('inserts a row and writes the secret to the vault', async () => {
        let storedId = '';
        fakeDb.execute.mockImplementationOnce(async (_sql, params) => {
            storedId = (params as string[])[0] ?? '';
            return { rowsAffected: 1, lastInsertId: 0 };
        });
        fakeDb.select.mockImplementationOnce(async () => [
            {
                id: storedId,
                provider_id: 'openai',
                nickname: 'Personal',
                created_at: '2026-05-09',
            },
        ]);
        const row = await addApiKey({
            providerId: 'openai',
            nickname: 'Personal',
            secret: 'sk-test',
        });
        expect(row.providerId).toBe('openai');
        expect(row.nickname).toBe('Personal');
        expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO api_keys/i),
            [row.id, 'openai', 'Personal'],
        );
        expect(core.invoke).toHaveBeenCalledWith('set_secret', {
            secretId: row.id,
            key: 'sk-test',
        });
    });

    it('rolls back the SQL row when the vault write fails', async () => {
        vi.mocked(core.invoke).mockRejectedValueOnce(new Error('keychain denied'));
        await expect(
            addApiKey({ providerId: 'openai', nickname: 'X', secret: 'sk' }),
        ).rejects.toThrow(/keychain/);
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM api_keys WHERE id/i),
            expect.any(Array),
        );
    });
});

describe('db.deleteApiKey', () => {
    it('deletes the row, removes the vault secret, and clears active when needed', async () => {
        fakeDb.select
            .mockResolvedValueOnce([{ value: 'mc-1' }]) // active id lookup
            .mockResolvedValueOnce([{ id: 'mc-1' }]); // dependent model_configs (active)
        await deleteApiKey('key-1');
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM api_keys WHERE id/i),
            ['key-1'],
        );
        expect(core.invoke).toHaveBeenCalledWith('delete_secret', { secretId: 'key-1' });
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM app_state/i),
            ['active_model_config_id'],
        );
    });

    it('does not clear active when the active config is unrelated', async () => {
        fakeDb.select
            .mockResolvedValueOnce([{ value: 'mc-other' }])
            .mockResolvedValueOnce([{ id: 'mc-1' }]); // dependents do not include mc-other
        await deleteApiKey('key-1');
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /DELETE FROM app_state/i.test(s))).toBe(false);
    });
});

describe('db.listModelConfigDependencies', () => {
    it('returns model configs joined with api_keys for a given key id', async () => {
        fakeDb.select.mockResolvedValueOnce([
            {
                id: 'mc-1',
                api_key_id: 'key-1',
                model_id: 'whisper-1',
                provider_id: 'openai',
                nickname: 'Personal',
            },
        ]);
        const rows = await listModelConfigDependencies('key-1');
        expect(rows).toEqual([
            {
                id: 'mc-1',
                apiKeyId: 'key-1',
                modelId: 'whisper-1',
                providerId: 'openai',
                apiKeyNickname: 'Personal',
            },
        ]);
    });
});

describe('db.listModelConfigs', () => {
    it('returns model configs joined with api_keys', async () => {
        fakeDb.select.mockResolvedValueOnce([
            {
                id: 'mc-1',
                api_key_id: 'key-1',
                model_id: 'whisper-1',
                provider_id: 'openai',
                nickname: 'Personal',
            },
        ]);
        const rows = await listModelConfigs();
        expect(rows[0]?.providerId).toBe('openai');
        expect(rows[0]?.apiKeyNickname).toBe('Personal');
    });
});

describe('db.addModelConfig', () => {
    it('inserts a row and returns it', async () => {
        let storedId = '';
        fakeDb.execute.mockImplementationOnce(async (_sql, params) => {
            storedId = (params as string[])[0] ?? '';
            return { rowsAffected: 1, lastInsertId: 0 };
        });
        fakeDb.select.mockImplementationOnce(async () => [
            {
                id: storedId,
                api_key_id: 'key-1',
                model_id: 'whisper-1',
                provider_id: 'openai',
                nickname: 'Personal',
            },
        ]);
        const row = await addModelConfig({ apiKeyId: 'key-1', modelId: 'whisper-1' });
        expect(row.apiKeyId).toBe('key-1');
        expect(row.modelId).toBe('whisper-1');
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO model_configs/i),
            [row.id, 'key-1', 'whisper-1'],
        );
    });
});

describe('db.deleteModelConfig', () => {
    it('clears active selection when the deleted config was active', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'mc-1' }]);
        await deleteModelConfig('mc-1');
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /DELETE FROM model_configs/i.test(s))).toBe(true);
        expect(calls.some((s) => /DELETE FROM app_state/i.test(s))).toBe(true);
    });

    it('keeps active selection when deleting a non-active config', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'mc-other' }]);
        await deleteModelConfig('mc-1');
        const calls = fakeDb.execute.mock.calls.map((c) => c[0]);
        expect(calls.some((s) => /DELETE FROM app_state/i.test(s))).toBe(false);
    });
});

describe('db.activeModelConfigId', () => {
    it('returns null when no row exists', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getActiveModelConfigId()).resolves.toBeNull();
    });

    it('returns the value when set', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'mc-1' }]);
        await expect(getActiveModelConfigId()).resolves.toBe('mc-1');
    });

    it('upserts when setting', async () => {
        await setActiveModelConfigId('mc-2');
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state.*ON CONFLICT/is),
            ['active_model_config_id', 'mc-2'],
        );
    });

    it('deletes when setting null', async () => {
        await setActiveModelConfigId(null);
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM app_state/i),
            ['active_model_config_id'],
        );
    });
});

describe('db.overlayEnabled', () => {
    it('returns true when no row exists (default)', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getOverlayEnabled()).resolves.toBe(true);
    });

    it('returns true when stored value is "true"', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'true' }]);
        await expect(getOverlayEnabled()).resolves.toBe(true);
    });

    it('returns false when stored value is "false"', async () => {
        fakeDb.select.mockResolvedValueOnce([{ value: 'false' }]);
        await expect(getOverlayEnabled()).resolves.toBe(false);
    });

    it('upserts "true" when setOverlayEnabled(true)', async () => {
        await setOverlayEnabled(true);
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state.*ON CONFLICT/is),
            ['overlay_enabled', 'true'],
        );
    });

    it('upserts "false" when setOverlayEnabled(false)', async () => {
        await setOverlayEnabled(false);
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state.*ON CONFLICT/is),
            ['overlay_enabled', 'false'],
        );
    });
});

describe('db.overlayPosition', () => {
    it('returns null when no rows exist', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getOverlayPosition()).resolves.toBeNull();
    });

    it('returns null when only x exists', async () => {
        fakeDb.select.mockResolvedValueOnce([{ key: 'overlay_x', value: '100' }]);
        await expect(getOverlayPosition()).resolves.toBeNull();
    });

    it('returns {x, y} when both rows exist', async () => {
        fakeDb.select.mockResolvedValueOnce([
            { key: 'overlay_x', value: '100' },
            { key: 'overlay_y', value: '200' },
        ]);
        await expect(getOverlayPosition()).resolves.toEqual({ x: 100, y: 200 });
    });

    it('returns null when stored values are non-numeric', async () => {
        fakeDb.select.mockResolvedValueOnce([
            { key: 'overlay_x', value: 'oops' },
            { key: 'overlay_y', value: 'nope' },
        ]);
        await expect(getOverlayPosition()).resolves.toBeNull();
    });

    it('upserts both x and y when setOverlayPosition is called', async () => {
        await setOverlayPosition({ x: 100, y: 200 });
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state.*ON CONFLICT/is),
            ['overlay_x', '100'],
        );
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state.*ON CONFLICT/is),
            ['overlay_y', '200'],
        );
    });

    it('rounds float coordinates before persisting', async () => {
        await setOverlayPosition({ x: 100.7, y: 200.3 });
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state/i),
            ['overlay_x', '101'],
        );
        expect(fakeDb.execute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO app_state/i),
            ['overlay_y', '200'],
        );
    });
});

describe('db.getModelConfigWithApiKey', () => {
    it('returns null when not found', async () => {
        fakeDb.select.mockResolvedValueOnce([]);
        await expect(getModelConfigWithApiKey('nope')).resolves.toBeNull();
    });

    it('returns the joined row when found', async () => {
        fakeDb.select.mockResolvedValueOnce([
            {
                id: 'mc-1',
                api_key_id: 'key-1',
                model_id: 'whisper-1',
                provider_id: 'openai',
                nickname: 'Personal',
            },
        ]);
        const row = await getModelConfigWithApiKey('mc-1');
        expect(row).toEqual({
            id: 'mc-1',
            apiKeyId: 'key-1',
            modelId: 'whisper-1',
            providerId: 'openai',
            apiKeyNickname: 'Personal',
        });
    });
});
