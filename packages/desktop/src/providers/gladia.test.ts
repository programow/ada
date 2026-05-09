import { describe, expect, it } from 'vitest';
import { gladiaConfig as cfg } from './gladia';

describe('gladia provider config', () => {
    it('has the required identity fields', () => {
        expect(cfg.id).toBe('gladia');
        expect(cfg.name).toBe('Gladia');
        expect(cfg.docsUrl).toMatch(/^https:\/\//);
    });

    it('has at least one default model', () => {
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

    it('listModels is null (Gladia exposes a single transcription model)', () => {
        expect(cfg.listModels).toBeNull();
    });

    it('makeModel returns a model object regardless of supplied id', () => {
        const m = cfg.makeModel('whisper-large-v3', 'gladia-test');
        expect(m).toBeDefined();
    });
});
