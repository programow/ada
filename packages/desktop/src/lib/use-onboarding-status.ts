import { type PermissionState, type PlatformInfo, vox } from '@/lib/invoke';
import { type PermissionKey, type RequiredPermissions, requiredPermissions } from '@/lib/platform';
import { useCallback, useEffect, useRef, useState } from 'react';

export type StatusMap = Partial<Record<PermissionKey, PermissionState>>;

export interface OnboardingStatus {
    loading: boolean;
    platform: PlatformInfo | null;
    permissions: RequiredPermissions | null;
    statuses: StatusMap;
    allGranted: boolean;
    refresh: () => Promise<void>;
}

/**
 * Maps a [`PermissionKey`](./platform.ts) to its (non-prompting) status
 * check command. We deliberately use the non-prompting accessibility
 * variant here — the hook polls every second, and using the prompting
 * variant would spam the user with native dialogs.
 */
async function checkPermission(key: PermissionKey): Promise<PermissionState> {
    switch (key) {
        case 'microphone':
            return vox.checkMicrophonePermission();
        case 'accessibility':
            return vox.checkAccessibilityPermission();
        case 'input-monitoring':
            return vox.checkInputMonitoringPermission();
    }
}

/**
 * Polls the current status of every required permission on this platform.
 *
 * On mount:
 * 1. calls `getPlatformInfo` once to determine which permissions apply,
 * 2. runs an immediate status check for each required permission,
 * 3. schedules a 1s interval to re-poll until unmounted.
 *
 * The poller is serialised (we wait for the previous tick's `Promise.all`
 * to settle before starting the next), so a slow `check_*` command won't
 * cause overlapping invokes to pile up.
 */
export function useOnboardingStatus(): OnboardingStatus {
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState<PlatformInfo | null>(null);
    const [permissions, setPermissions] = useState<RequiredPermissions | null>(null);
    const [statuses, setStatuses] = useState<StatusMap>({});
    const inFlightRef = useRef(false);

    const refresh = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const info =
                platform ??
                (await (async () => {
                    const p = await vox.getPlatformInfo();
                    setPlatform(p);
                    return p;
                })());
            const req = permissions ?? requiredPermissions(info);
            if (!permissions) setPermissions(req);

            const entries = await Promise.all(
                req.required.map(async (k) => [k, await checkPermission(k)] as const),
            );
            const next: StatusMap = {};
            for (const [k, v] of entries) next[k] = v;
            setStatuses(next);
        } catch (e) {
            console.error('useOnboardingStatus: refresh failed', e);
        } finally {
            inFlightRef.current = false;
        }
    }, [platform, permissions]);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        async function tick() {
            await refresh();
            if (cancelled) return;
            if (loading) setLoading(false);
            timer = setTimeout(() => void tick(), 1000);
        }

        void tick();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
        // refresh closure captures `platform`/`permissions`; both are stable
        // after first read, so re-running the effect on their change is a
        // no-op other than re-seeding the interval.
    }, [refresh, loading]);

    const allGranted =
        permissions !== null &&
        permissions.required.length > 0 &&
        permissions.required.every((k) => statuses[k] === 'Granted');

    return { loading, platform, permissions, statuses, allGranted, refresh };
}
