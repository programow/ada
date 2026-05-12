import * as core from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { __resetPlatformCacheForTests, getPlatform } from './use-platform';

beforeEach(() => {
    vi.mocked(core.invoke).mockReset();
    __resetPlatformCacheForTests();
});

describe('getPlatform', () => {
    it('invokes the Rust command exactly once across multiple concurrent calls', async () => {
        vi.mocked(core.invoke).mockResolvedValue({ os: 'macos', isWayland: false });
        const [a, b, c] = await Promise.all([getPlatform(), getPlatform(), getPlatform()]);
        expect(a).toEqual({ os: 'macos', isWayland: false });
        expect(b).toEqual({ os: 'macos', isWayland: false });
        expect(c).toEqual({ os: 'macos', isWayland: false });
        expect(core.invoke).toHaveBeenCalledTimes(1);
        expect(core.invoke).toHaveBeenCalledWith('get_platform_info');
    });

    it('serves the cached value on subsequent sequential calls without re-invoking', async () => {
        vi.mocked(core.invoke).mockResolvedValue({ os: 'linux', isWayland: true });
        await getPlatform();
        await getPlatform();
        await getPlatform();
        expect(core.invoke).toHaveBeenCalledTimes(1);
    });

    it('re-invokes after the cache is reset', async () => {
        vi.mocked(core.invoke).mockResolvedValueOnce({ os: 'macos', isWayland: false });
        await getPlatform();
        expect(core.invoke).toHaveBeenCalledTimes(1);

        __resetPlatformCacheForTests();

        vi.mocked(core.invoke).mockResolvedValueOnce({ os: 'windows', isWayland: false });
        const second = await getPlatform();
        expect(second).toEqual({ os: 'windows', isWayland: false });
        expect(core.invoke).toHaveBeenCalledTimes(2);
    });
});
