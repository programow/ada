// @vitest-environment node
import { experimental_transcribe as transcribe } from 'ai';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { azureOpenaiConfig as cfg } from './azure-openai';

describe('azure-openai provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('azure-openai');
        expect(cfg.name).toBe('Azure OpenAI');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
        expect(cfg.apiKeyHelpUrl).toMatch(/^https:\/\//);
        expect(cfg.pricingDocsUrl).toMatch(/^https:\/\//);
        expect(typeof cfg.makeModel).toBe('function');
    });

    it('has at least one default model (deployment-scoped)', () => {
        expect(cfg.defaultModels.length).toBeGreaterThan(0);
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-03');
        }
    });

    it('listModels is null (Azure deployments are user-defined)', () => {
        expect(cfg.listModels).toBeNull();
    });
});

describe('azure-openai transcription HTTP', () => {
    const server = setupServer();
    const previousResourceName = process.env.AZURE_RESOURCE_NAME;

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => {
        server.close();
        // Restore (or clear) the env var we mutated.
        process.env.AZURE_RESOURCE_NAME = previousResourceName;
    });
    beforeEach(() => {
        process.env.AZURE_RESOURCE_NAME = 'bluemacawtest';
    });

    const fakeAudio = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

    it('POSTs to the resource-scoped openai endpoint with api-key header and api-version query', async () => {
        const captured: {
            apiKey: string | null;
            url: URL | null;
            contentType: string | null;
        } = { apiKey: null, url: null, contentType: null };
        server.use(
            http.post(
                'https://bluemacawtest.openai.azure.com/openai/v1/audio/transcriptions',
                ({ request }) => {
                    captured.apiKey = request.headers.get('api-key');
                    captured.contentType = request.headers.get('content-type');
                    captured.url = new URL(request.url);
                    return HttpResponse.json({ text: 'hello from azure' });
                },
            ),
        );

        const model = cfg.makeModel('whisper-deployment', 'az-test-key');
        const result = await transcribe({ model, audio: fakeAudio, maxRetries: 0 });

        expect(result.text).toBe('hello from azure');
        expect(captured.apiKey).toBe('az-test-key');
        expect(captured.url?.host).toBe('bluemacawtest.openai.azure.com');
        expect(captured.url?.pathname).toBe('/openai/v1/audio/transcriptions');
        expect(captured.url?.searchParams.get('api-version')).toBeTruthy();
        // OpenAI-style transcription uses multipart form data.
        expect(captured.contentType ?? '').toMatch(/multipart\/form-data/);
    });

    it('propagates 401 unauthorized errors', async () => {
        server.use(
            http.post('https://bluemacawtest.openai.azure.com/openai/v1/audio/transcriptions', () =>
                HttpResponse.json({ error: { message: 'unauthorized' } }, { status: 401 }),
            ),
        );
        const model = cfg.makeModel('whisper-deployment', 'bad-key');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });

    it('propagates 429 rate-limit errors', async () => {
        server.use(
            http.post('https://bluemacawtest.openai.azure.com/openai/v1/audio/transcriptions', () =>
                HttpResponse.json({ error: { message: 'rate limited' } }, { status: 429 }),
            ),
        );
        const model = cfg.makeModel('whisper-deployment', 'az-test');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });

    it('does not crash on a 500 with HTML body', async () => {
        server.use(
            http.post('https://bluemacawtest.openai.azure.com/openai/v1/audio/transcriptions', () =>
                HttpResponse.html('<html>upstream error</html>', { status: 500 }),
            ),
        );
        const model = cfg.makeModel('whisper-deployment', 'az-test');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });
});
