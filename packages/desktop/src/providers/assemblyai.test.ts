import { describe, expect, it } from 'vitest';
import { assemblyaiConfig as cfg } from './assemblyai';

describe('assemblyai provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('assemblyai');
        expect(cfg.name).toBe('AssemblyAI');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
    });

    it('default models include universal-3-pro and universal-2', () => {
        const ids = cfg.defaultModels.map((m) => m.id).sort();
        expect(ids).toEqual(['universal-2', 'universal-3-pro']);
    });

    it('has pricing entries for every default model', () => {
        for (const m of cfg.defaultModels) {
            const entry = cfg.pricing[m.id];
            expect(entry).toBeDefined();
            expect(entry?.perMinuteUSD).toBeGreaterThan(0);
            expect(entry?.lastUpdated).toBe('2026-05-11');
        }
    });

    it('listModels is null (AssemblyAI tier is configured by feature flags)', () => {
        expect(cfg.listModels).toBeNull();
    });

    it('makeModel returns a model object', () => {
        const m = cfg.makeModel('universal-3-pro', 'aai-test');
        expect(m).toBeDefined();
    });
});
