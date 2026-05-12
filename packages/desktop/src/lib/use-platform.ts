import { useEffect, useState } from 'react';
import { type PlatformInfo, vox } from './invoke';

/**
 * Process-global cache of the platform info returned by the Rust
 * `get_platform_info` command. PlatformInfo cannot change at runtime
 * (the host OS doesn't morph while the app is running), so a single
 * fetch is shared across the whole webview. Subsequent callers reuse
 * the cached value without re-invoking Tauri.
 */
let cached: PlatformInfo | null = null;
let inFlight: Promise<PlatformInfo> | null = null;

/**
 * Fetch the platform info, deduplicating concurrent callers. The first
 * call invokes the Rust command; any callers that arrive while it is in
 * flight share the same promise; once resolved the value is cached and
 * returned synchronously to all future callers via the resolved promise.
 */
export async function getPlatform(): Promise<PlatformInfo> {
    if (cached) return cached;
    if (inFlight) return inFlight;
    inFlight = vox.getPlatformInfo().then((p) => {
        cached = p;
        inFlight = null;
        return p;
    });
    return inFlight;
}

/**
 * React hook that returns the current `PlatformInfo` or `null` while the
 * first fetch is in flight. After the cache is warmed (the first mount
 * anywhere in the app), subsequent `usePlatform()` calls return the
 * cached value synchronously on first render — there's no flicker.
 */
export function usePlatform(): PlatformInfo | null {
    const [p, setP] = useState<PlatformInfo | null>(cached);
    useEffect(() => {
        if (cached) return;
        let cancelled = false;
        void getPlatform().then((info) => {
            if (!cancelled) setP(info);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return p;
}

/**
 * Test-only helper: clear the module-level cache so each test starts
 * fresh. Underscore-prefixed to flag it as not part of the public API.
 */
export function __resetPlatformCacheForTests(): void {
    cached = null;
    inFlight = null;
}
