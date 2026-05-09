// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { groqConfig as cfg } from './groq';

describe('groq provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('groq');
        expect(cfg.name).toBe('Groq');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
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

    it('makeModel returns a model object', () => {
        const m = cfg.makeModel('whisper-large-v3', 'gsk-test');
        expect(m).toBeDefined();
    });
});

describe('groq listModels', () => {
    const server = setupServer(
        http.get('https://api.groq.com/openai/v1/models', () =>
            HttpResponse.json({
                data: [
                    { id: 'whisper-large-v3' },
                    { id: 'whisper-large-v3-turbo' },
                    { id: 'distil-whisper-large-v3-en' },
                    { id: 'llama-3.3-70b-versatile' },
                    { id: 'mixtral-8x7b-32768' },
                ],
            }),
        ),
    );

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it('listModels filters to whisper/distil entries', async () => {
        expect(cfg.listModels).not.toBeNull();
        const models = await cfg.listModels?.('gsk-test');
        const ids = models?.map((m) => m.id).sort();
        expect(ids).toEqual([
            'distil-whisper-large-v3-en',
            'whisper-large-v3',
            'whisper-large-v3-turbo',
        ]);
    });
});
