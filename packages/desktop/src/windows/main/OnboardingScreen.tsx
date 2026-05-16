import { Card } from '@/components/ui/card';
import { type ApiKeyRow, listApiKeys } from '@/lib/db';
import { markOnboardingCompleted } from '@/lib/onboarding';
import {
    hasAllPermissionsSet,
    hasApiKeySet,
    hasHotkeysConfigured,
    hasModelConfigSet,
} from '@/lib/onboarding-silent-skip';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { OnboardingStepFirstApiKey } from './onboarding/OnboardingStepFirstApiKey';
import { OnboardingStepFirstModel } from './onboarding/OnboardingStepFirstModel';
import { OnboardingStepHotkeys } from './onboarding/OnboardingStepHotkeys';
import { OnboardingStepPermissions } from './onboarding/OnboardingStepPermissions';

interface OnboardingScreenProps {
    /** Called when the user completes (or explicitly opts out of the
     * optional final step). Parent should route to the main UI. */
    onComplete: () => void;
}

type Step = 1 | 2 | '3a' | '3b';

interface Predicates {
    permissions: boolean;
    hotkeys: boolean;
    apiKey: boolean;
    modelConfig: boolean;
}

const STEP_ORDER: ReadonlyArray<Step> = [1, 2, '3a', '3b'];

function predicateForStep(s: Step, p: Predicates): boolean {
    if (s === 1) return p.permissions;
    if (s === 2) return p.hotkeys;
    if (s === '3a') return p.apiKey;
    return p.modelConfig;
}

function firstUnsatisfied(p: Predicates): Step | null {
    for (const s of STEP_ORDER) if (!predicateForStep(s, p)) return s;
    return null;
}

function nextNeededStep(after: Step, p: Predicates): Step | null {
    const start = STEP_ORDER.indexOf(after) + 1;
    for (let i = start; i < STEP_ORDER.length; i++) {
        const candidate = STEP_ORDER[i];
        if (candidate !== undefined && !predicateForStep(candidate, p)) return candidate;
    }
    return null;
}

function hasPrecedingUnsatisfied(current: Step, p: Predicates): boolean {
    const idx = STEP_ORDER.indexOf(current);
    for (let i = 0; i < idx; i++) {
        const candidate = STEP_ORDER[i];
        if (candidate !== undefined && !predicateForStep(candidate, p)) return true;
    }
    return false;
}

const STEP_LABELS: ReadonlyArray<{ key: 1 | 2 | 3; label: string }> = [
    { key: 1, label: 'Permissions' },
    { key: 2, label: 'Hotkeys' },
    { key: 3, label: 'Provider' },
];

function activeIndicatorKey(step: Step): 1 | 2 | 3 {
    if (step === 1) return 1;
    if (step === 2) return 2;
    return 3;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<Step | null>(null);
    const [predicates, setPredicates] = useState<Predicates>({
        permissions: false,
        hotkeys: false,
        apiKey: false,
        modelConfig: false,
    });
    /**
     * The API key 3b should attach a new model config to. Populated either
     * (a) from an existing `api_keys` row when the wizard lands directly
     * on 3b, or (b) from the user's freshly-saved key when they completed
     * 3a. Cleared otherwise; the wizard must never mount 3b without it.
     */
    const [keyForModelStep, setKeyForModelStep] = useState<{
        apiKeyId: string;
        providerId: string;
    } | null>(null);
    /**
     * All API keys the user has on this machine, surfaced to sub-step 3a
     * so they can see what's already configured (and decide whether to add
     * another or just continue with what they have). Populated on initial
     * probe and appended to after a successful save in 3a.
     */
    const [existingApiKeys, setExistingApiKeys] = useState<ApiKeyRow[]>([]);

    const finish = useCallback(async () => {
        try {
            await markOnboardingCompleted();
        } catch (e) {
            console.error('markOnboardingCompleted failed', e);
        }
        onComplete();
    }, [onComplete]);

    // Probe all four predicates on mount and pick the first not-yet-satisfied
    // step. If everything has flipped to true between the gate's decision and
    // the wizard mounting (race), defensively finish without rendering steps.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const [permissions, hotkeys, apiKey, modelConfig] = await Promise.all([
                hasAllPermissionsSet(),
                hasHotkeysConfigured(),
                hasApiKeySet(),
                hasModelConfigSet(),
            ]);
            if (cancelled) return;
            const next: Predicates = { permissions, hotkeys, apiKey, modelConfig };
            setPredicates(next);
            // Fetch the full list of existing keys whenever 3a's predicate
            // is already true. The list seeds (a) the keyForModelStep target
            // for a direct 3b landing, and (b) the read-only "you've already
            // added these keys" panel inside 3a if the user navigates there.
            if (apiKey) {
                try {
                    const keys = await listApiKeys();
                    if (cancelled) return;
                    setExistingApiKeys(keys);
                    const first = keys[0];
                    if (first && !modelConfig) {
                        setKeyForModelStep({
                            apiKeyId: first.id,
                            providerId: first.providerId,
                        });
                    }
                } catch (e) {
                    console.error('OnboardingScreen: listApiKeys failed', e);
                }
            }
            const target = firstUnsatisfied(next);
            setLoading(false);
            if (target === null) {
                void finish();
                return;
            }
            setStep(target);
        })();
        return () => {
            cancelled = true;
        };
    }, [finish]);

    const advanceAfter = useCallback(
        (completed: Step, nextPredicates: Predicates) => {
            const target = nextNeededStep(completed, nextPredicates);
            if (target === null) {
                void finish();
                return;
            }
            setStep(target);
        },
        [finish],
    );

    const handlePermissionsNext = useCallback(() => {
        const next: Predicates = { ...predicates, permissions: true };
        setPredicates(next);
        advanceAfter(1, next);
    }, [predicates, advanceAfter]);

    const handleHotkeysNext = useCallback(() => {
        const next: Predicates = { ...predicates, hotkeys: true };
        setPredicates(next);
        advanceAfter(2, next);
    }, [predicates, advanceAfter]);

    const handleApiKeySaved = useCallback(
        (saved: ApiKeyRow) => {
            setKeyForModelStep({ apiKeyId: saved.id, providerId: saved.providerId });
            setExistingApiKeys((prev) => [...prev, saved]);
            const next: Predicates = { ...predicates, apiKey: true };
            setPredicates(next);
            advanceAfter('3a', next);
        },
        [predicates, advanceAfter],
    );

    const handleBack = useCallback(() => {
        if (step === null) return;
        const idx = STEP_ORDER.indexOf(step);
        for (let i = idx - 1; i >= 0; i--) {
            const candidate = STEP_ORDER[i];
            if (candidate !== undefined && !predicateForStep(candidate, predicates)) {
                setStep(candidate);
                return;
            }
        }
    }, [step, predicates]);

    if (loading || step === null) {
        return (
            <main
                className="flex min-h-screen items-center justify-center bg-bg text-fg"
                data-testid="onboarding-screen"
            >
                <p className="text-sm text-muted-foreground" data-testid="onboarding-loading">
                    Setting up…
                </p>
            </main>
        );
    }

    const activeKey = activeIndicatorKey(step);
    const linearBackFn = hasPrecedingUnsatisfied(step, predicates) ? handleBack : undefined;
    // Inside step 3 the user can always backtrack — 3a → 2 (Hotkeys),
    // 3b → 3a — even when the preceding step's predicate is already
    // satisfied. Tweaking the hotkeys or reviewing existing keys mid-
    // onboarding is a normal thing to want; "no preceding unsatisfied
    // step" only justifies hiding Back for steps 1 and 2.
    const goBackToHotkeys = () => setStep(2);
    const goBackToApiKey = () => setStep('3a');

    return (
        <main className="min-h-screen bg-bg px-6 py-10 text-fg" data-testid="onboarding-screen">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
                <header className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-blue/10 text-brand-blue shadow-card dark:bg-main/20 dark:text-main-foreground">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-6 w-6 stroke-current"
                        >
                            <rect x="9" y="3" width="6" height="12" rx="3" />
                            <path d="M5 11a7 7 0 0 0 14 0" />
                            <path d="M12 18v3" />
                        </svg>
                    </span>
                    <h1 className="text-2xl font-extrabold tracking-tight">Welcome to bluemacaw</h1>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        Three quick steps and you're set: permissions, hotkeys, and your first
                        provider.
                    </p>
                    <ol
                        className="flex flex-row items-center gap-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        data-testid="onboarding-progress"
                    >
                        {STEP_LABELS.map((s, i) => (
                            <li key={s.key} className="flex items-center gap-2">
                                {i > 0 && <span aria-hidden="true">·</span>}
                                <span
                                    data-testid={`onboarding-progress-${s.key}`}
                                    data-active={activeKey === s.key ? 'true' : 'false'}
                                    className={cn(
                                        'flex items-center gap-1.5',
                                        activeKey === s.key && 'text-fg',
                                        activeKey > s.key &&
                                            'text-brand-blue dark:text-main-foreground',
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'inline-block h-1.5 w-1.5 rounded-full',
                                            activeKey === s.key
                                                ? 'bg-fg'
                                                : activeKey > s.key
                                                  ? 'bg-brand-blue dark:bg-main-foreground'
                                                  : 'bg-muted-foreground/40',
                                        )}
                                    />
                                    {s.label}
                                </span>
                            </li>
                        ))}
                    </ol>
                </header>

                <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
                    {step === 1 && <OnboardingStepPermissions onNext={handlePermissionsNext} />}
                    {step === 2 && (
                        <OnboardingStepHotkeys onBack={linearBackFn} onNext={handleHotkeysNext} />
                    )}
                    {step === '3a' && (
                        <OnboardingStepFirstApiKey
                            onBack={goBackToHotkeys}
                            existingKeys={existingApiKeys}
                            onSaved={handleApiKeySaved}
                            onContinueExisting={keyForModelStep ? () => setStep('3b') : undefined}
                            onSkipFinish={() => void finish()}
                        />
                    )}
                    {step === '3b' &&
                        (keyForModelStep ? (
                            <OnboardingStepFirstModel
                                apiKeyId={keyForModelStep.apiKeyId}
                                providerId={keyForModelStep.providerId}
                                onBack={goBackToApiKey}
                                onFinish={() => void finish()}
                            />
                        ) : (
                            // Defensive: we should always have a key by the time
                            // step 3b mounts — either fetched on initial probe
                            // (existing key + no model config) or set by 3a's
                            // save. If we somehow don't, finishing is the
                            // least-broken option.
                            <Card className="p-4">
                                <p className="text-sm text-muted-foreground">
                                    No API key available; finishing onboarding.
                                </p>
                            </Card>
                        ))}
                </section>
            </div>
        </main>
    );
}
