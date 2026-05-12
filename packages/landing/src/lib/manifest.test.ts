import { describe, expect, it, vi } from 'vitest';
import { fetchManifest } from './manifest';

describe('fetchManifest', () => {
    it('returns the parsed manifest on a successful response', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            version: '0.1.0',
                            mac: 'https://github.com/programow/vox-era/releases/download/v0.1.0/Vox%20Era_0.1.0_universal.dmg',
                            win: null,
                            linux: null,
                        }),
                        { status: 200 },
                    ),
            ) as typeof fetch,
        );
        const manifest = await fetchManifest();
        expect(manifest?.version).toBe('0.1.0');
        expect(manifest?.mac).toContain('.dmg');
        expect(manifest?.win).toBeNull();
        expect(manifest?.linux).toBeNull();
    });

    it('returns null when the response is not OK', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('not found', { status: 404 })) as typeof fetch,
        );
        expect(await fetchManifest()).toBeNull();
    });

    it('returns null when fetch throws', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network down');
            }) as typeof fetch,
        );
        expect(await fetchManifest()).toBeNull();
    });
});
