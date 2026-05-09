import { describe, expect, it } from 'vitest';

describe('vitest sanity', () => {
    it('happy-dom DOM works', () => {
        const div = document.createElement('div');
        div.textContent = 'hi';
        expect(div.textContent).toBe('hi');
    });
});
