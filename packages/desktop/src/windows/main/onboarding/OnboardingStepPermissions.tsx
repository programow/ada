import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type PermissionState, vox } from '@/lib/invoke';
import type { PermissionKey } from '@/lib/platform';
import { useOnboardingStatus } from '@/lib/use-onboarding-status';
import { cn } from '@/lib/utils';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface OnboardingStepPermissionsProps {
    /** Advance to the next step. Only callable when every required
     * permission is `Granted`. */
    onNext: () => void;
}

interface RowMeta {
    title: string;
    description: string;
    icon: ReactNode;
}

const ICON_BASE_CLASS = 'h-5 w-5 stroke-current text-brand-blue dark:text-main-foreground';

function MicIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={ICON_BASE_CLASS}
        >
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
        </svg>
    );
}

function AxIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={ICON_BASE_CLASS}
        >
            <circle cx="12" cy="5" r="1.6" />
            <path d="M4 9h16" />
            <path d="M12 9v12" />
            <path d="M9 21l3-6 3 6" />
        </svg>
    );
}

function KeyIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={ICON_BASE_CLASS}
        >
            <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
            <path d="M7 10h0.01M11 10h0.01M15 10h0.01M7 14h10" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 stroke-current"
        >
            <path d="M5 12.5 10 17 19 7" />
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 stroke-current"
        >
            <path d="M21 12a9 9 0 1 1-3.2-6.9" />
            <path d="M21 4v5h-5" />
        </svg>
    );
}

const ROW_META: Record<PermissionKey, RowMeta> = {
    microphone: {
        title: 'Microphone',
        description: 'Required to record your speech.',
        icon: <MicIcon />,
    },
    accessibility: {
        title: 'Accessibility',
        description: 'Lets bluemacaw paste transcribed text into the focused app.',
        icon: <AxIcon />,
    },
    'input-monitoring': {
        title: 'Input Monitoring',
        description: 'Lets bluemacaw listen for your Fn-key shortcut.',
        icon: <KeyIcon />,
    },
};

/**
 * Permissions whose grant only takes effect on the *next* process launch.
 * On macOS, TCC does not propagate authorisation changes into a running
 * process, so once we observe a transition Denied/NotDetermined → Granted
 * for any of these we show the user a restart CTA.
 */
const RESTART_REQUIRED: ReadonlySet<PermissionKey> = new Set(['accessibility', 'input-monitoring']);

function statusLabel(state: PermissionState | undefined): string {
    if (state === 'Granted') return 'Granted';
    if (state === 'Denied') return 'Not granted';
    if (state === 'NotDetermined') return 'Not asked';
    return 'Checking…';
}

function statusPillClass(state: PermissionState | undefined): string {
    if (state === 'Granted') {
        return 'bg-brand-mint/30 text-emerald-900 dark:bg-brand-mint/20 dark:text-brand-mint';
    }
    if (state === 'Denied') {
        return 'bg-brand-coral/20 text-rose-900 dark:bg-brand-coral/20 dark:text-brand-coral';
    }
    return 'bg-brand-yellow/25 text-amber-900 dark:bg-brand-yellow/20 dark:text-brand-yellow';
}

async function runGrant(key: PermissionKey, osIsMac: boolean): Promise<void> {
    if (key === 'microphone') {
        await vox.requestMicrophonePermission();
        return;
    }
    if (key === 'accessibility') {
        if (osIsMac) {
            // First try the prompting variant — it raises the native dialog
            // when not yet trusted. If the process is *already* recorded
            // as untrusted (subsequent calls are rate-limited by macOS),
            // fall back to the deep-link.
            const state = await vox.checkAccessibilityPermissionPrompting();
            if (state !== 'Granted') {
                await vox.openSettingsPanel('accessibility');
            }
            return;
        }
        await vox.requestAccessibilityPermission();
        return;
    }
    // input-monitoring
    await vox.requestInputMonitoringPermission();
    if (osIsMac) {
        // macOS does not show the dialog reliably from CGRequestListenEventAccess
        // in every state; deep-link as a backup so the user always lands on
        // the right panel.
        await vox.openSettingsPanel('input-monitoring');
    }
}

export function OnboardingStepPermissions({ onNext }: OnboardingStepPermissionsProps) {
    const { loading, platform, permissions, statuses, allGranted, refresh } = useOnboardingStatus();
    /**
     * Tracks whether any restart-required permission has transitioned to
     * Granted *while this step is mounted*. If true, the user must
     * relaunch bluemacaw for the grant to apply to the running process.
     */
    const [needsRestart, setNeedsRestart] = useState(false);
    // Ref (not state) for previous status — we only need it to detect
    // transitions; mutating it shouldn't trigger re-renders.
    const seenRef = useRef<Partial<Record<PermissionKey, PermissionState>>>({});

    useEffect(() => {
        if (!permissions) return;
        const prev = seenRef.current;
        let flipped = false;
        for (const k of permissions.required) {
            const cur = statuses[k];
            const prevVal = prev[k];
            if (
                RESTART_REQUIRED.has(k) &&
                prevVal !== undefined &&
                prevVal !== 'Granted' &&
                cur === 'Granted'
            ) {
                flipped = true;
            }
            if (cur !== undefined) prev[k] = cur;
        }
        if (flipped) setNeedsRestart(true);
    }, [statuses, permissions]);

    const handleGrant = useCallback(
        async (key: PermissionKey) => {
            // On macOS, TCC does not propagate Accessibility / Input Monitoring
            // grants into a running process — `AXIsProcessTrustedWithOptions`
            // and `CGPreflightListenEventAccess` keep returning Denied until
            // the app is relaunched. Surface the restart CTA the moment the
            // user clicks Grant for one of those, instead of waiting for a
            // Denied → Granted transition that the running process can never
            // observe.
            if (platform?.os === 'macos' && RESTART_REQUIRED.has(key)) {
                setNeedsRestart(true);
            }
            try {
                await runGrant(key, platform?.os === 'macos');
            } catch (e) {
                console.error(`grant ${key} failed`, e);
            }
            // Refresh immediately rather than waiting for the next 1s poll.
            await refresh();
        },
        [platform, refresh],
    );

    const handleRestart = useCallback(async () => {
        // Do NOT mark onboarding completed here — after restart we want the
        // user to land back on step 1 of the wizard, see the now-granted
        // permissions, click Next, and continue through hotkeys + first
        // provider. Marking completed would skip the remaining setup.
        try {
            await vox.restartApp();
        } catch (e) {
            console.error('restartApp failed', e);
        }
    }, []);

    if (loading || !platform || !permissions) {
        return (
            <div
                className="flex min-h-[12rem] items-center justify-center"
                data-testid="onboarding-step-permissions-loading"
            >
                <p className="text-sm text-muted-foreground">Checking permissions…</p>
            </div>
        );
    }

    const waylandBanner = permissions.informational?.some(
        (i) => i.kind === 'wayland-paste-fallback',
    );

    // If a platform legitimately requires no permissions (e.g. Linux/X11
    // with mic already auto-granted by the desktop env), Next is enabled
    // immediately — the user has nothing to do here.
    const canAdvance = permissions.required.length === 0 || allGranted;

    return (
        <div className="flex flex-col gap-6" data-testid="onboarding-step-permissions">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-extrabold tracking-tight">Permissions</h2>
                <p className="text-sm text-muted-foreground">
                    Grant the permissions bluemacaw needs to record and paste. You can't continue
                    until everything below is granted.
                </p>
            </div>

            <section className="flex flex-col gap-3">
                {permissions.required.map((key) => {
                    const meta = ROW_META[key];
                    const state = statuses[key];
                    const granted = state === 'Granted';
                    return (
                        <Card
                            key={key}
                            data-testid={`perm-row-${key}`}
                            className="flex flex-row items-center gap-4 p-4"
                        >
                            <span
                                aria-hidden="true"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 dark:bg-main/20"
                            >
                                {meta.icon}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <h3 className="text-sm font-bold leading-tight">{meta.title}</h3>
                                <p className="text-xs text-muted-foreground">{meta.description}</p>
                            </div>
                            {granted ? (
                                <span
                                    data-testid={`perm-status-${key}`}
                                    className={cn(
                                        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-mint/30 text-emerald-900 dark:bg-brand-mint/20 dark:text-brand-mint',
                                    )}
                                    aria-label="Granted"
                                    title="Granted"
                                >
                                    <CheckIcon />
                                </span>
                            ) : (
                                <>
                                    <span
                                        data-testid={`perm-status-${key}`}
                                        className={cn(
                                            'inline-flex shrink-0 items-center rounded-pill px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                                            statusPillClass(state),
                                        )}
                                    >
                                        {statusLabel(state)}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => void handleGrant(key)}
                                        data-testid={`perm-grant-${key}`}
                                    >
                                        Grant
                                    </Button>
                                </>
                            )}
                        </Card>
                    );
                })}
            </section>

            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refresh()}
                    data-testid="perm-refresh"
                >
                    <RefreshIcon />
                    <span className="ml-2">Refresh</span>
                </Button>
                <p className="text-xs text-muted-foreground">
                    bluemacaw rechecks every second — Refresh forces it now.
                </p>
            </div>

            {waylandBanner && (
                <Card
                    data-testid="wayland-banner"
                    className="flex flex-row items-start gap-3 bg-brand-yellow/15 p-4 dark:bg-brand-yellow/10"
                >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-brand-yellow/40 text-amber-900 dark:text-brand-yellow">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3 stroke-current"
                        >
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </svg>
                    </span>
                    <p className="text-xs leading-relaxed text-fg">
                        You're on Wayland. bluemacaw will copy transcribed text to your clipboard
                        automatically — press Ctrl+V to paste, since Wayland blocks synthetic
                        keystrokes.
                    </p>
                </Card>
            )}

            {needsRestart && (
                <Card
                    data-testid="restart-banner"
                    className="flex flex-row items-center justify-between gap-3 bg-brand-yellow/20 p-4 dark:bg-brand-yellow/15"
                >
                    <p className="text-xs leading-relaxed text-fg">
                        Toggle the switch in System Settings, then click Restart. macOS won't tell
                        bluemacaw about the grant until it relaunches — so the row above may still
                        say “Not granted” until then.
                    </p>
                    <Button
                        size="sm"
                        onClick={() => void handleRestart()}
                        data-testid="perm-restart"
                    >
                        Restart
                    </Button>
                </Card>
            )}

            <div className="flex flex-row items-center justify-end gap-2 pt-2">
                <Button disabled={!canAdvance} onClick={onNext} data-testid="perm-continue">
                    Next
                </Button>
            </div>
        </div>
    );
}
