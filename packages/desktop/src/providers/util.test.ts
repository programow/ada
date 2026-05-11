import { describe, expect, it } from 'vitest';
import { formatPricePerMin, modelPriceLabel, providerName } from './util';

describe('providerName', () => {
    it('returns the canonical display name for a known provider', () => {
        expect(providerName('openai')).toBe('OpenAI');
    });

    it('returns the id verbatim when the provider is unknown', () => {
        expect(providerName('unknown-provider')).toBe('unknown-provider');
    });
});

describe('formatPricePerMin', () => {
    it('formats cent-or-more rates with 4 decimals', () => {
        expect(formatPricePerMin(0.5)).toBe('$0.5000/min');
    });

    it('formats exactly-one-cent rates with 4 decimals', () => {
        expect(formatPricePerMin(0.01)).toBe('$0.0100/min');
    });

    it('formats sub-cent rates trimming trailing zeros', () => {
        expect(formatPricePerMin(0.006)).toBe('$0.006/min');
    });

    it('formats very small sub-cent rates', () => {
        expect(formatPricePerMin(0.0001)).toBe('$0.0001/min');
    });
});

describe('modelPriceLabel', () => {
    it('returns a $X/min string for a known provider/model with pricing', () => {
        expect(modelPriceLabel('openai', 'whisper-1')).toBe('$0.006/min');
    });

    it('returns null for an unknown model on a known provider', () => {
        expect(modelPriceLabel('openai', 'nonexistent-model')).toBeNull();
    });

    it('returns null for an unknown provider', () => {
        expect(modelPriceLabel('unknown-provider', 'whisper-1')).toBeNull();
    });
});
