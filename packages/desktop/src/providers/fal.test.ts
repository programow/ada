import { describe, expect, it } from 'vitest';
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
