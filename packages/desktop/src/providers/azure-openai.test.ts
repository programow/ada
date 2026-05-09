import { describe, expect, it } from 'vitest';
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
