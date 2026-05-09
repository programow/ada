import { describe, expect, it } from 'vitest';
import { revaiConfig as cfg } from './revai';

describe('revai provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('revai');
        expect(cfg.name).toBe('Rev.ai');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
    });

    it('default models include machine and low_cost', () => {
        const ids = cfg.defaultModels.map((m) => m.id);
        expect(ids).toContain('machine');
        expect(ids).toContain('low_cost');
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-03');
        }
    });

    it('listModels is null (Rev.ai uses hardcoded list)', () => {
        expect(cfg.listModels).toBeNull();
    });

    it('makeModel returns a model object', () => {
        const m = cfg.makeModel('machine', 'rev-test');
        expect(m).toBeDefined();
    });
});
