import { describe, expect, it } from 'vitest';
import { formatBulkAsMd, formatRowAsMd, formatRowAsTxt } from './export';

const row = {
    id: 1,
    createdAt: new Date('2026-05-09T10:00:00Z').getTime(),
    text: 'Hello world.',
    durationMs: 4500,
    wordCount: 2,
    providerId: 'openai',
    modelId: 'whisper-1',
};

describe('export.formatRowAsTxt', () => {
    it('returns just the text', () => {
        expect(formatRowAsTxt(row)).toBe('Hello world.');
    });
});

describe('export.formatRowAsMd', () => {
    it('renders an H1 + metadata + blockquote', () => {
        const md = formatRowAsMd(row);
        expect(md).toMatch(/^# Transcription/);
        expect(md).toContain('Provider: openai');
        expect(md).toContain('Model: whisper-1');
        expect(md).toContain('Words: 2');
        expect(md).toContain('> Hello world.');
    });
});

describe('export.formatBulkAsMd', () => {
    it('renders an H1 followed by H2 sections per row', () => {
        const md = formatBulkAsMd([row, { ...row, id: 2, text: 'Two.' }], 'all');
        expect(md.startsWith('# Vox Era')).toBe(true);
        expect((md.match(/^## Transcription/gm) ?? []).length).toBe(2);
        expect(md).toContain('Hello world.');
        expect(md).toContain('Two.');
    });
});
