// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openaiConfig as cfg } from './openai';

describe('openai provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('openai');
        expect(cfg.name).toBe('OpenAI');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
        expect(cfg.apiKeyHelpUrl).toMatch(/^https:\/\//);
        expect(cfg.pricingDocsUrl).toMatch(/^https:\/\//);
        expect(typeof cfg.makeModel).toBe('function');
    });

    it('exposes more than one default model', () => {
        expect(cfg.defaultModels.length).toBeGreaterThan(1);
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-03');
        }
    });

    it('makeModel returns a TranscriptionModelV3-like object', () => {
        const m = cfg.makeModel('whisper-1', 'sk-test');
        expect(m).toBeDefined();
        expect(typeof m).toBe('object');
    });
});

describe('openai listModels', () => {
    const server = setupServer(
        http.get('https://api.openai.com/v1/models', ({ request }) => {
            const auth = request.headers.get('authorization');
            if (auth !== 'Bearer sk-test') {
                return new HttpResponse(null, { status: 401 });
            }
            return HttpResponse.json({
                data: [
                    { id: 'whisper-1' },
                    { id: 'gpt-4o-transcribe' },
                    { id: 'gpt-4o-mini-transcribe' },
                    { id: 'gpt-4o-mini' },
                    { id: 'text-embedding-3-small' },
                ],
            });
        }),
    );

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it('listModels filters to known transcription model IDs', async () => {
        expect(cfg.listModels).not.toBeNull();
        const models = await cfg.listModels?.('sk-test');
        const ids = models?.map((m) => m.id).sort();
        expect(ids).toEqual(['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1']);
    });
});
