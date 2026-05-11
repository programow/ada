import { vox } from '@/lib/invoke';
import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding';
import { type PermissionKey, requiredPermissions } from '@/lib/platform';
import { useEffect, useState } from 'react';

export type OnboardingGateState = 'loading' | 'show-onboarding' | 'show-main';

async function checkPermission(key: PermissionKey) {
    if (key === 'microphone') return vox.checkMicrophonePermission();
    if (key === 'accessibility') return vox.checkAccessibilityPermission();
    return vox.checkInputMonitoringPermission();
}

/**
 * One-shot gate that decides whether to show the onboarding screen or the
 * main UI on app launch.
 *
 * Decision tree:
 * 1. If the user previously completed onboarding (store flag is true), go
 *    straight to the main UI.
 * 2. Otherwise, ask Rust for the platform + check every required
 *    permission *once*.
 * 3. If all required permissions are already Granted (the common case on
 *    Windows + Linux/X11), silently mark onboarding complete and route to
 *    the main UI — the user never sees the screen.
 * 4. Otherwise, route to the onboarding screen.
 *
 * Errors are swallowed (and logged); on failure we default to showing
 * onboarding rather than skipping it, since a broken store read is
 * recoverable but a missing-permission scenario without onboarding is not.
 */
export function useOnboardingGate(): { state: OnboardingGateState; complete: () => void } {
    const [state, setState] = useState<OnboardingGateState>('loading');

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const done = await isOnboardingCompleted();
                if (cancelled) return;
                if (done) {
                    setState('show-main');
                    return;
                }
                const info = await vox.getPlatformInfo();
                if (cancelled) return;
                const req = requiredPermissions(info);
                const results = await Promise.all(req.required.map((k) => checkPermission(k)));
                if (cancelled) return;
                const allGranted = results.every((r) => r === 'Granted');
                if (allGranted) {
                    try {
                        await markOnboardingCompleted();
                    } catch (e) {
                        console.error('silent markOnboardingCompleted failed', e);
                    }
                    if (cancelled) return;
                    setState('show-main');
                } else {
                    setState('show-onboarding');
                }
            } catch (e) {
                console.error('useOnboardingGate failed; defaulting to onboarding', e);
                if (!cancelled) setState('show-onboarding');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return {
        state,
        complete: () => setState('show-main'),
    };
}
