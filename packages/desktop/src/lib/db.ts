import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

const DB_URL = 'sqlite:vox-era.db';
const ACTIVE_MODEL_CONFIG_KEY = 'active_model_config_id';
const OVERLAY_ENABLED_KEY = 'overlay_enabled';
const OVERLAY_X_KEY = 'overlay_x';
const OVERLAY_Y_KEY = 'overlay_y';
const SELECTED_MIC_DEVICE_KEY = 'selected_mic_device_id';
const HOTKEY_COMBO_KEY = 'hotkey_combo';

export interface ApiKeyRow {
    id: string;
    providerId: string;
    nickname: string;
    createdAt: string;
}

export interface OverlayPosition {
    x: number;
    y: number;
}

export interface ModelConfigWithApiKey {
    id: string;
    apiKeyId: string;
    modelId: string;
    providerId: string;
    apiKeyNickname: string;
}

export interface TranscriptionRow {
    id: number;
    createdAt: number;
    text: string;
    durationMs: number;
    wordCount: number;
    providerId: string;
    modelId: string;
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

    // Promote first-ever config to active so the recording loop has a target
    // without requiring the user to discover the click-to-activate UX.
    const currentActive = await getActiveModelConfigId();
    if (currentActive === null) {
        await setActiveModelConfigId(id);
    }

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

export async function getOverlayPosition(): Promise<OverlayPosition | null> {
    const conn = await db();
    const rows = (await conn.select('SELECT key, value FROM app_state WHERE key IN (?, ?)', [
        OVERLAY_X_KEY,
        OVERLAY_Y_KEY,
    ])) as { key: string; value: string }[];
    const x = rows.find((r) => r.key === OVERLAY_X_KEY)?.value;
    const y = rows.find((r) => r.key === OVERLAY_Y_KEY)?.value;
    if (x === undefined || y === undefined) return null;
    const xn = Number.parseInt(x, 10);
    const yn = Number.parseInt(y, 10);
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) return null;
    return { x: xn, y: yn };
}

export async function setOverlayPosition(pos: OverlayPosition): Promise<void> {
    const conn = await db();
    const upsert =
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
    await conn.execute(upsert, [OVERLAY_X_KEY, String(Math.round(pos.x))]);
    await conn.execute(upsert, [OVERLAY_Y_KEY, String(Math.round(pos.y))]);
}

export async function getModelConfigWithApiKey(id: string): Promise<ModelConfigWithApiKey | null> {
    const conn = await db();
    const rows = (await conn.select(`${SELECT_MODEL_CONFIGS_JOINED} WHERE mc.id = ?`, [
        id,
    ])) as RawModelConfigJoined[];
    return rows[0] ? mapModelConfig(rows[0]) : null;
}

export async function getSelectedMicDeviceId(): Promise<string | null> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        SELECTED_MIC_DEVICE_KEY,
    ])) as { value: string }[];
    return rows[0]?.value ?? null;
}

export async function setSelectedMicDeviceId(id: string | null): Promise<void> {
    const conn = await db();
    if (id === null) {
        await conn.execute('DELETE FROM app_state WHERE key = ?', [SELECTED_MIC_DEVICE_KEY]);
        return;
    }
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [SELECTED_MIC_DEVICE_KEY, id],
    );
}

function defaultHotkeyCombo(): string {
    // Detect macOS without DOM (in tests we are happy-dom; this branch is taken).
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
    return isMac ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
}

export async function getHotkeyCombo(): Promise<string> {
    const conn = await db();
    const rows = (await conn.select('SELECT value FROM app_state WHERE key = ?', [
        HOTKEY_COMBO_KEY,
    ])) as { value: string }[];
    return rows[0]?.value ?? defaultHotkeyCombo();
}

export async function setHotkeyCombo(combo: string): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [HOTKEY_COMBO_KEY, combo],
    );
}

function countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

export async function saveTranscription(input: {
    text: string;
    durationMs: number;
    providerId: string;
    modelId: string;
}): Promise<void> {
    const conn = await db();
    await conn.execute(
        'INSERT INTO transcriptions (created_at, text, duration_ms, word_count, provider_id, model_id) VALUES (?, ?, ?, ?, ?, ?)',
        [
            Date.now(),
            input.text,
            input.durationMs,
            countWords(input.text),
            input.providerId,
            input.modelId,
        ],
    );
}

interface RawTranscription {
    id: number;
    created_at: number;
    text: string;
    duration_ms: number;
    word_count: number;
    provider_id: string;
    model_id: string;
}

export async function listTranscriptions(
    options: { limit?: number; offset?: number } = {},
): Promise<TranscriptionRow[]> {
    const conn = await db();
    const limit = options.limit ?? 200;
    const offset = options.offset ?? 0;
    const rows = (await conn.select(
        'SELECT id, created_at, text, duration_ms, word_count, provider_id, model_id FROM transcriptions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset],
    )) as RawTranscription[];
    return rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        text: r.text,
        durationMs: r.duration_ms,
        wordCount: r.word_count,
        providerId: r.provider_id,
        modelId: r.model_id,
    }));
}

export async function softDeleteTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('UPDATE transcriptions SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function restoreTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('UPDATE transcriptions SET deleted_at = NULL WHERE id = ?', [id]);
}

export async function hardDeleteTranscription(id: number): Promise<void> {
    const conn = await db();
    await conn.execute('DELETE FROM transcriptions WHERE id = ?', [id]);
}

export async function clearAllTranscriptions(): Promise<{ deleted: number }> {
    const conn = await db();
    const result = (await conn.execute('DELETE FROM transcriptions', [])) as {
        rowsAffected: number;
    };
    return { deleted: result.rowsAffected };
}
