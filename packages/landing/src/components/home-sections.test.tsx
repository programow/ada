import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Demo } from './demo';
import { Download } from './download';
import { Features } from './features';
import { PrivacyTeaser } from './privacy-teaser';
import { ProvidersGrid } from './providers-grid';

describe('home sections', () => {
    it('Demo renders the demo image', () => {
        render(<Demo />);
        expect(screen.getByAltText(/recording demo/i)).toBeInTheDocument();
    });

    it('Features renders all 6 cards', () => {
        render(<Features />);
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    });

    it('ProvidersGrid renders all 9 provider names', () => {
        render(<ProvidersGrid />);
        for (const name of [
            'AssemblyAI',
            'Azure OpenAI',
            'Deepgram',
            'ElevenLabs',
            'Fal',
            'Gladia',
            'Groq',
            'OpenAI',
            'Rev.ai',
        ]) {
            expect(screen.getByText(name)).toBeInTheDocument();
        }
    });

    it('PrivacyTeaser links to /privacy/', () => {
        render(<PrivacyTeaser />);
        expect(screen.getByRole('link', { name: /privacy story/i })).toHaveAttribute(
            'href',
            '/privacy/',
        );
    });

    it('Download resolves manifest and renders a mac link with coming-soon for null platforms', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            tag_name: 'v0.1.0',
                            assets: [
                                {
                                    name: 'Vox.Era_0.1.0_universal.dmg',
                                    browser_download_url: 'https://example.test/Vox-Era.dmg',
                                },
                            ],
                        }),
                        { status: 200 },
                    ),
            ) as typeof fetch,
        );
        render(<Download />);
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /macOS/i })).toHaveAttribute(
                'href',
                'https://example.test/Vox-Era.dmg',
            );
        });
        expect(screen.queryByRole('link', { name: /Windows/i })).toBeNull();
        expect(screen.queryByRole('link', { name: /Linux/i })).toBeNull();
        expect(screen.getAllByText(/coming soon/i)).toHaveLength(2);
    });
});
