// @vitest-environment node
import { experimental_transcribe as transcribe } from 'ai';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { falConfig as cfg } from './fal';

describe('fal provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('fal');
        expect(cfg.name).toBe('Fal');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
    });

    it('default models include whisper and wizper', () => {
        const ids = cfg.defaultModels.map((m) => m.id).sort();
        expect(ids).toEqual(['whisper', 'wizper']);
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-03');
        }
    });

    it('listModels is null (Fal uses hardcoded list)', () => {
        expect(cfg.listModels).toBeNull();
    });

    it('makeModel returns a model object', () => {
        const m = cfg.makeModel('whisper', 'fal-test');
        expect(m).toBeDefined();
    });
});

describe('fal transcription HTTP', () => {
    const server = setupServer();

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    const fakeAudio = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

    it('POSTs to queue.fal.run and polls until success with Key auth', async () => {
        const captured: {
            submitAuth: string | null;
            submitUrl: URL | null;
            submitBody: Record<string, unknown> | null;
            pollUrl: URL | null;
            pollAuth: string | null;
        } = {
            submitAuth: null,
            submitUrl: null,
            submitBody: null,
            pollUrl: null,
            pollAuth: null,
        };
        server.use(
            http.post('https://queue.fal.run/fal-ai/whisper', async ({ request }) => {
                captured.submitAuth = request.headers.get('authorization');
                captured.submitUrl = new URL(request.url);
                captured.submitBody = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ request_id: 'req-123' });
            }),
            http.get('https://queue.fal.run/fal-ai/whisper/requests/req-123', ({ request }) => {
                captured.pollAuth = request.headers.get('authorization');
                captured.pollUrl = new URL(request.url);
                return HttpResponse.json({ text: 'hello from fal', chunks: [] });
            }),
        );

        const model = cfg.makeModel('whisper', 'fal-test-key');
        const result = await transcribe({ model, audio: fakeAudio, maxRetries: 0 });

        expect(result.text).toBe('hello from fal');
        expect(captured.submitAuth).toBe('Key fal-test-key');
        expect(captured.pollAuth).toBe('Key fal-test-key');
        expect(captured.submitUrl?.host).toBe('queue.fal.run');
        expect(captured.submitUrl?.pathname).toBe('/fal-ai/whisper');
        expect(captured.pollUrl?.pathname).toBe('/fal-ai/whisper/requests/req-123');
        // Body must include the data URL audio payload
        expect(typeof captured.submitBody?.audio_url).toBe('string');
        expect(String(captured.submitBody?.audio_url)).toMatch(/^data:audio\//);
    });

    it('propagates 401 unauthorized errors on submit', async () => {
        server.use(
            http.post('https://queue.fal.run/fal-ai/whisper', () =>
                HttpResponse.json({ error: { message: 'unauthorized' } }, { status: 401 }),
            ),
        );
        const model = cfg.makeModel('whisper', 'bad-key');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });

    it('propagates 429 rate-limit errors on submit', async () => {
        server.use(
            http.post('https://queue.fal.run/fal-ai/whisper', () =>
                HttpResponse.json({ error: { message: 'rate limited' } }, { status: 429 }),
            ),
        );
        const model = cfg.makeModel('whisper', 'fal-test');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });

    it('does not crash on a 500 with non-JSON HTML body', async () => {
        server.use(
            http.post('https://queue.fal.run/fal-ai/whisper', () =>
                HttpResponse.html('<html>upstream error</html>', { status: 500 }),
            ),
        );
        const model = cfg.makeModel('whisper', 'fal-test');
        await expect(transcribe({ model, audio: fakeAudio, maxRetries: 0 })).rejects.toThrow();
    });
});
