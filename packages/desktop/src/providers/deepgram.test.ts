import { describe, expect, it } from 'vitest';
import { deepgramConfig as cfg } from './deepgram';

describe('deepgram provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('deepgram');
        expect(cfg.name).toBe('Deepgram');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
    });

    it('exposes more than one default model', () => {
        expect(cfg.defaultModels.length).toBeGreaterThan(1);
    });

    it('default model ids include nova-3 and nova-2', () => {
        const ids = cfg.defaultModels.map((m) => m.id);
        expect(ids).toContain('nova-3');
        expect(ids).toContain('nova-2');
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-03');
        }
    });

    it('listModels is null (Deepgram uses hardcoded list)', () => {
        expect(cfg.listModels).toBeNull();
    });

    it('makeModel returns a model object', () => {
        const m = cfg.makeModel('nova-3', 'dg-test');
        expect(m).toBeDefined();
    });
});
