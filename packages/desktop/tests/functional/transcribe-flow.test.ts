// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@tauri-apps/api/core';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../src/lib/db', () => ({
    getActiveModelConfigId: vi.fn(),
    getModelConfigWithApiKey: vi.fn(),
}));

import * as db from '../../src/lib/db';
import { transcribe } from '../../src/lib/transcribe';

const here = resolve(fileURLToPath(import.meta.url), '..');
const fixture = (name: string) => readFileSync(resolve(here, '..', 'fixtures', 'audio', name));

const server = setupServer(
    http.post('https://api.openai.com/v1/audio/transcriptions', async () => {
        return HttpResponse.json({
            text: 'hello world',
            language: 'en',
            duration: 1.5,
        });
    }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
    server.resetHandlers();
    vi.mocked(core.invoke).mockReset();
    vi.mocked(db.getActiveModelConfigId).mockReset();
    vi.mocked(db.getModelConfigWithApiKey).mockReset();
});
afterAll(() => server.close());

function stubOpenAiActive(modelId = 'whisper-1', secret: string | null = 'sk-test') {
    vi.mocked(db.getActiveModelConfigId).mockResolvedValue('mc-1');
    vi.mocked(db.getModelConfigWithApiKey).mockResolvedValue({
        id: 'mc-1',
        apiKeyId: 'key-1',
        modelId,
        providerId: 'openai',
        apiKeyNickname: 'Personal',
    });
    vi.mocked(core.invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_secret') return secret;
        throw new Error(`unexpected invoke: ${cmd}`);
    });
}

describe('functional: full transcribe flow', () => {
    it('hello-world fixture transcribes via OpenAI provider end-to-end', async () => {
        stubOpenAiActive();
        const blob = new Blob([fixture('hello-world.wav')], { type: 'audio/wav' });
        const text = await transcribe(blob);
        expect(text).toBe('hello world');
    });

    it('long-speech fixture flows through the orchestrator', async () => {
        stubOpenAiActive();
        const blob = new Blob([fixture('long-speech.wav')], { type: 'audio/wav' });
        const text = await transcribe(blob);
        expect(text).toBe('hello world');
    });

    it('propagates non-retriable provider HTTP errors as thrown errors', async () => {
        stubOpenAiActive();
        server.use(
            http.post('https://api.openai.com/v1/audio/transcriptions', () =>
                HttpResponse.json(
                    { error: { message: 'invalid file format', type: 'invalid_request_error' } },
                    { status: 400 },
                ),
            ),
        );
        const blob = new Blob([fixture('hello-world.wav')], { type: 'audio/wav' });
        await expect(transcribe(blob)).rejects.toThrow();
    });

    it('throws when no API key is configured for the active provider', async () => {
        stubOpenAiActive('whisper-1', null);
        const blob = new Blob([fixture('hello-world.wav')], { type: 'audio/wav' });
        await expect(transcribe(blob)).rejects.toThrow(/No API key/);
    });
});
