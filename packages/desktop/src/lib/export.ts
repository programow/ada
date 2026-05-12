import type { TranscriptionRow } from './db';

function iso(ms: number): string {
    return new Date(ms).toISOString();
}

function durationLabel(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRowAsTxt(row: TranscriptionRow): string {
    return row.text;
}

export function formatRowAsMd(row: TranscriptionRow): string {
    return [
        `# Transcription · ${iso(row.createdAt)}`,
        '',
        `- Provider: ${row.providerId}`,
        `- Model: ${row.modelId}`,
        `- Duration: ${durationLabel(row.durationMs)}`,
        `- Words: ${row.wordCount}`,
        '',
        `> ${row.text.replace(/\n/g, '\n> ')}`,
        '',
    ].join('\n');
}

export function formatBulkAsMd(rows: readonly TranscriptionRow[], rangeLabel: string): string {
    const header = `# bluemacaw — Transcription Export · ${rangeLabel}\n\n`;
    const body = rows
        .map((row) =>
            [
                `## Transcription · ${iso(row.createdAt)}`,
                '',
                `- Provider: ${row.providerId}`,
                `- Model: ${row.modelId}`,
                `- Duration: ${durationLabel(row.durationMs)}`,
                `- Words: ${row.wordCount}`,
                '',
                `> ${row.text.replace(/\n/g, '\n> ')}`,
                '',
            ].join('\n'),
        )
        .join('\n');
    return header + body;
}

export function downloadBlob(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
