import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { type PermissionState, vox } from '@/lib/invoke';
import { markOnboardingCompleted } from '@/lib/onboarding';
import type { PermissionKey } from '@/lib/platform';
import { useOnboardingStatus } from '@/lib/use-onboarding-status';
import { useCallback, useEffect, useRef, useState } from 'react';

interface OnboardingScreenProps {
    /** Called when the user completes or skips onboarding. Parent should
     * route to the main UI. */
    onComplete: () => void;
}

interface RowMeta {
    title: string;
    description: string;
    icon: string;
}

const ROW_META: Record<PermissionKey, RowMeta> = {
    microphone: {
        title: 'Microphone',
        description: 'Required to record your speech.',
        icon: 'MIC',
    },
    accessibility: {
        title: 'Accessibility',
        description: 'Lets Vox Era paste transcribed text into the focused app.',
        icon: 'AX',
    },
    'input-monitoring': {
        title: 'Input Monitoring',
        description: 'Lets Vox Era listen for your Fn-key shortcut.',
        icon: 'KEY',
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

function statusBadgeClass(state: PermissionState | undefined): string {
    if (state === 'Granted') return 'bg-green-300';
    if (state === 'Denied') return 'bg-red-300';
    return 'bg-yellow-300';
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

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const { loading, platform, permissions, statuses, allGranted, refresh } = useOnboardingStatus();
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    /**
     * Tracks which restart-required permissions have transitioned to
     * Granted *while this screen is mounted*. If non-empty, the user must
     * restart Vox Era for the grant to apply to the running process.
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

    const handleSkipConfirm = useCallback(async () => {
        try {
            await markOnboardingCompleted();
        } catch (e) {
            console.error('markOnboardingCompleted failed', e);
        }
        setShowSkipConfirm(false);
        onComplete();
    }, [onComplete]);

    const handleContinue = useCallback(async () => {
        try {
            await markOnboardingCompleted();
        } catch (e) {
            console.error('markOnboardingCompleted failed', e);
        }
        onComplete();
    }, [onComplete]);

    const handleRestart = useCallback(async () => {
        // Mark completed first so a brand-new launch routes straight to the
        // main UI after restart — the user already finished the gestures.
        try {
            await markOnboardingCompleted();
        } catch (e) {
            console.error('markOnboardingCompleted before restart failed', e);
        }
        try {
            await vox.restartApp();
        } catch (e) {
            console.error('restartApp failed', e);
        }
    }, []);

    if (loading || !platform || !permissions) {
        return (
            <main
                className="flex min-h-screen items-center justify-center bg-bg text-fg"
                data-testid="onboarding-loading"
            >
                <p className="text-sm font-medium">Checking permissions…</p>
            </main>
        );
    }

    const waylandBanner = permissions.informational?.some(
        (i) => i.kind === 'wayland-paste-fallback',
    );

    return (
        <main className="min-h-screen bg-bg p-6 text-fg" data-testid="onboarding-screen">
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
                <header className="flex flex-col gap-2">
                    <h1 className="text-3xl font-extrabold uppercase tracking-tight">
                        Welcome to Vox Era
                    </h1>
                    <p className="text-sm font-medium normal-case">
                        Vox Era needs a few permissions to work. We'll only ask for what's needed on
                        your system.
                    </p>
                </header>

                <section className="flex flex-col gap-3">
                    {permissions.required.map((key) => {
                        const meta = ROW_META[key];
                        const state = statuses[key];
                        const granted = state === 'Granted';
                        return (
                            <Card key={key} data-testid={`perm-row-${key}`}>
                                <CardHeader className="mb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className="border-3 border-border bg-main px-2 py-0.5 text-[10px] font-extrabold"
                                        >
                                            {meta.icon}
                                        </span>
                                        {meta.title}
                                    </CardTitle>
                                    <span
                                        data-testid={`perm-status-${key}`}
                                        className={`border-3 border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusBadgeClass(state)}`}
                                    >
                                        {statusLabel(state)}
                                    </span>
                                </CardHeader>
                                <CardContent className="flex flex-row items-center justify-between gap-3 text-sm font-medium normal-case">
                                    <p>{meta.description}</p>
                                    {!granted && (
                                        <Button
                                            size="sm"
                                            onClick={() => void handleGrant(key)}
                                            data-testid={`perm-grant-${key}`}
                                        >
                                            Grant
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </section>

                {waylandBanner && (
                    <Card
                        data-testid="wayland-banner"
                        className="border-3 border-border bg-yellow-100"
                    >
                        <CardContent className="text-xs font-medium normal-case">
                            You're on Wayland. Vox Era will copy transcribed text to your clipboard
                            automatically — press Ctrl+V to paste, since Wayland blocks synthetic
                            keystrokes.
                        </CardContent>
                    </Card>
                )}

                {needsRestart && (
                    <Card
                        data-testid="restart-banner"
                        className="border-3 border-border bg-yellow-200"
                    >
                        <CardContent className="flex flex-row items-center justify-between gap-3 text-xs font-medium normal-case">
                            <p>
                                You just granted a permission. Quit and reopen Vox Era for it to
                                take effect.
                            </p>
                            <Button
                                size="sm"
                                onClick={() => void handleRestart()}
                                data-testid="perm-restart"
                            >
                                Restart
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <footer className="flex flex-row items-center justify-between gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSkipConfirm(true)}
                        data-testid="perm-skip"
                    >
                        Skip for now
                    </Button>
                    <Button
                        disabled={!allGranted}
                        onClick={() => void handleContinue()}
                        data-testid="perm-continue"
                    >
                        Continue
                    </Button>
                </footer>
            </div>

            <Dialog open={showSkipConfirm} onOpenChange={(o) => !o && setShowSkipConfirm(false)}>
                <DialogContent data-testid="skip-confirm-dialog">
                    <DialogHeader>
                        <DialogTitle>Skip permissions?</DialogTitle>
                        <DialogDescription>
                            You can grant permissions later in Settings — but recording and paste
                            won't work until you do.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowSkipConfirm(false)}
                            data-testid="skip-cancel"
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void handleSkipConfirm()} data-testid="skip-confirm">
                            Skip anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
