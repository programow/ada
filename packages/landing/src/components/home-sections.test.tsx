import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

    it('PrivacyTeaser links to /privacy', () => {
        render(<PrivacyTeaser />);
        expect(screen.getByRole('link', { name: /read more/i })).toHaveAttribute(
            'href',
            '/privacy',
        );
    });

    it('Download renders three platform buttons', () => {
        render(<Download manifest={{ macUrl: '#', winUrl: '#', linuxUrl: '#' }} />);
        expect(screen.getByRole('link', { name: /macOS/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Windows/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Linux/i })).toBeInTheDocument();
    });
});
