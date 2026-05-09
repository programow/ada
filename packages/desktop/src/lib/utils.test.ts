import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
    it('joins class names', () => {
        expect(cn('a', 'b')).toBe('a b');
    });

    it('drops falsy values', () => {
        expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
    });

    it('merges conflicting tailwind utilities (last wins)', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
});
