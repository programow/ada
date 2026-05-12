import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from './hero';

describe('Hero', () => {
    it('renders the headline', () => {
        render(<Hero />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/speech.to.text/i);
    });

    it('renders a primary download CTA', () => {
        render(<Hero />);
        expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument();
    });
});
