import { describe, expect, it } from 'vitest';
import { requiredPermissions } from './platform';

describe('requiredPermissions', () => {
    it('returns the three macOS permissions on macOS', () => {
        const r = requiredPermissions({ os: 'macos', isWayland: false });
        expect(r.required).toEqual(['microphone', 'accessibility', 'input-monitoring']);
        expect(r.informational).toBeUndefined();
    });

    it('returns only microphone on Windows', () => {
        const r = requiredPermissions({ os: 'windows', isWayland: false });
        expect(r.required).toEqual(['microphone']);
        expect(r.informational).toBeUndefined();
    });

    it('returns only microphone on Linux/X11 with no informational notices', () => {
        const r = requiredPermissions({ os: 'linux', isWayland: false });
        expect(r.required).toEqual(['microphone']);
        expect(r.informational).toBeUndefined();
    });

    it('returns the wayland-paste-fallback notice on Linux/Wayland', () => {
        const r = requiredPermissions({ os: 'linux', isWayland: true });
        expect(r.required).toEqual(['microphone']);
        expect(r.informational).toEqual([{ kind: 'wayland-paste-fallback' }]);
    });
});
