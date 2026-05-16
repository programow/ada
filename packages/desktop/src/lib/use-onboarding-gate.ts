import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding';
import { shouldSilentSkip } from '@/lib/onboarding-silent-skip';
import { useEffect, useState } from 'react';

export type OnboardingGateState = 'loading' | 'show-onboarding' | 'show-main';

/**
 * One-shot gate that decides whether to show the onboarding screen or the
 * main UI on app launch. Three-way decision tree:
 *
 * 1. **Persisted flag set** → straight to main. The user has finished
 *    the wizard at least once on this machine.
 * 2. **Flag unset, but `shouldSilentSkip()` returns true** → mark the
 *    flag and route to main. Every wizard step's requirement is
 *    already satisfied (typical case: an existing user from before this
 *    wizard existed, or a user whose state has been seeded through some
 *    other path). The mark means future launches short-circuit at (1).
 * 3. **Flag unset and prerequisites missing** → show the wizard.
 *
 * The decision in (2) is intentionally factored into `shouldSilentSkip`
 * so a future redesign that adds/removes a step only has to touch that
 * one function — the gate itself stays small and easy to read.
 *
 * Errors are swallowed (and logged); on failure we default to showing
 * onboarding rather than skipping it, since a broken probe is recoverable
 * but a missing-setup main UI is not.
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
                const canSkip = await shouldSilentSkip();
                if (cancelled) return;
                if (canSkip) {
                    try {
                        await markOnboardingCompleted();
                    } catch (e) {
                        console.error('silent markOnboardingCompleted failed', e);
                    }
                    if (cancelled) return;
                    setState('show-main');
                    return;
                }
                setState('show-onboarding');
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
