import { describe, expect, it } from 'vitest';

describe('vitest sanity', () => {
    it('runs and adds numbers', () => {
        expect(1 + 1).toBe(2);
    });

    it('has happy-dom DOM globals', () => {
        const div = document.createElement('div');
        div.textContent = 'hello';
        expect(div.textContent).toBe('hello');
    });
});
