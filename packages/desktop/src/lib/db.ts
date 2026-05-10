import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

const DB_URL = 'sqlite:vox-era.db';
const ACTIVE_MODEL_CONFIG_KEY = 'active_model_config_id';
const OVERLAY_ENABLED_KEY = 'overlay_enabled';

export interface ApiKeyRow {
    id: string;
    providerId: string;
    nickname: string;
    createdAt: string;
}

export interface ModelConfigWithApiKey {
    id: string;
    apiKeyId: string;
    modelId: string;
    providerId: string;
    apiKeyNickname: string;
}

let cached: Promise<Awaited<ReturnType<typeof Database.load>>> | null = null;
function db() {
    if (!cached) cached = Database.load(DB_URL);
    return cached;
}

function newId(): string {
    return crypto.randomUUID();
}

interface RawApiKey {
    id: string;
    provider_id: string;
    nickname: string;
    created_at: string;
}
interface RawModelConfigJoined {
    id: string;
    api_key_id: string;
    model_id: string;
    provider_id: string;
    nickname: string;
}

const SELECT_MODEL_CONFIGS_JOINED = `
    SELECT mc.id, mc.api_key_id, mc.model_id, ak.provider_id, ak.nickname
    FROM model_configs mc
    JOIN api_keys ak ON ak.id = mc.api_key_id
`;

function mapApiKey(r: RawApiKey): ApiKeyRow {
    return {
        id: r.id,
        providerId: r.provider_id,
        nickname: r.nickname,
        createdAt: r.created_at,
    };
}

function mapModelConfig(r: RawModelConfigJoined): ModelConfigWithApiKey {
    return {
        id: r.id,
        apiKeyId: r.api_key_id,
        modelId: r.model_id,
        providerId: r.provider_id,
        apiKeyNickname: r.nickname,
    };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
    const conn = await db();
    const rows = (await conn.select(
        'SELECT id, provider_id, nickname, created_at FROM api_keys ORDER BY created_at',
    )) as RawApiKey[];
    return rows.map(mapApiKey);
}

export async function addApiKey(input: {
    providerId: string;
    nickname: string;
    secret: string;
}): Promise<ApiKeyRow> {
    const conn = await db();
    const id = newId();
    await conn.execute('INSERT INTO api_keys (id, provider_id, nickname) VALUES (?, ?, ?)', [
        id,
        input.providerId,
        input.nickname,
    ]);
    try {
        await invoke<void>('set_secret', { secretId: id, key: input.secret });
    } catch (err) {
        await conn.execute('DELETE FROM api_keys WHERE id = ?', [id]);
        throw err;
    }
    const rows = (await conn.select(
        'SELECT id, provider_id, nickname, created_at FROM api_keys WHERE id = ?',
        [id],
    )) as RawApiKey[];
    const row = rows[0];
    if (!row) throw new Error('Inserted api_key disappeared before read-back');
    return mapApiKey(row);
}

export async function deleteApiKey(id: string): Promise<void> {
    const conn = await db();
    const activeId = await getActiveModelConfigId();
    const dependents = await listModelConfigDependencies(id);
    await conn.execute('DELETE FROM api_keys WHERE id = ?', [id]);
    await invoke<void>('delete_secret', { secretId: id });
    if (activeId !== null && dependents.some((d) => d.id === activeId)) {
        await conn.execute('DELETE FROM app_state WHERE key = ?', [ACTIVE_MODEL_CONFIG_KEY]);
    }
}

export async function listModelConfigs(): Promise<ModelConfigWithApiKey[]> {
    const conn = await db();
    const rows = (await conn.select(
        `${SELECT_MODEL_CONFIGS_JOINED} ORDER BY mc.created_at`,
    )) as RawModelConfigJoined[];
    return rows.map(mapModelConfig);
}

export async function listModelConfigDependencies(
    apiKeyId: string,
): Promise<ModelConfigWithApiKey[]> {
    const conn = await db();
    const rows = (await conn.select(`${SELECT_MODEL_CONFIGS_JOINED} WHERE mc.api_key_id = ?`, [
        apiKeyId,
    ])) as RawModelConfigJoined[];
    return rows.map(mapModelConfig);
}

export async function addModelConfig(input: {
    apiKeyId: string;
    modelId: string;
}): Promise<ModelConfigWithApiKey> {
    const conn = await db();
    const id = newId();
    await conn.execute('INSERT INTO model_configs (id, api_key_id, model_id) VALUES (?, ?, ?)', [
        id,
        input.apiKeyId,
        input.modelId,
    ]);
    const rows = (await conn.select(`${SELECT_MODEL_CONFIGS_JOINED} WHERE mc.id = ?`, [
        id,
    ])) as RawModelConfigJoined[];
    const row = rows[0];
    if (!row) throw new Error('Inserted model_config disappeared before read-back');
    return mapModelConfig(row);
}

export async function deleteModelConfig(id: string): Promise<void> {
    const conn = await db();
    const activeId = await getActiveModelConfigId();
    await conn.execute('DELETE FROM model_configs WHERE id = ?', [id]);
    if (activeId === id) {
        await conn.execute('DELETE FROM app_state WHERE key = ?', [ACTIVE_MODEL_CONFIG_KEY]);
    }
}

export async function getActiveModelConfigId(): Promise<string | null> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        ACTIVE_MODEL_CONFIG_KEY,
    ])) as { value: string }[];
    return rows[0]?.value ?? null;
}

export async function setActiveModelConfigId(id: string | null): Promise<void> {
    const conn = await db();
    if (id === null) {
        await conn.execute('DELETE FROM app_state WHERE key = ?', [ACTIVE_MODEL_CONFIG_KEY]);
        return;
    }
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [ACTIVE_MODEL_CONFIG_KEY, id],
    );
}

export async function getOverlayEnabled(): Promise<boolean> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        OVERLAY_ENABLED_KEY,
    ])) as { value: string }[];
    if (!rows[0]) return true;
    return rows[0].value === 'true';
}

export async function setOverlayEnabled(enabled: boolean): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [OVERLAY_ENABLED_KEY, enabled ? 'true' : 'false'],
    );
}

export async function getModelConfigWithApiKey(id: string): Promise<ModelConfigWithApiKey | null> {
    const conn = await db();
    const rows = (await conn.select(`${SELECT_MODEL_CONFIGS_JOINED} WHERE mc.id = ?`, [
        id,
    ])) as RawModelConfigJoined[];
    return rows[0] ? mapModelConfig(rows[0]) : null;
}
