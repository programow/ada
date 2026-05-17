import { Button } from '@/components/ui/button';
import type { UpdaterStatus } from '@/hooks/useUpdater';
import { cn } from '@/lib/utils';

export interface UpdateBannerProps {
    status: UpdaterStatus;
    onInstall: () => void;
    onDismissError?: () => void;
}

/**
 * In-window banner that surfaces an available/installing update at the top
 * of the main window. Renders nothing for terminal states the user doesn't
 * need to act on (idle, checking, up-to-date) so it only appears when
 * there's something to do or report.
 */
export function UpdateBanner({ status, onInstall, onDismissError }: UpdateBannerProps) {
    if (status.kind === 'idle' || status.kind === 'checking' || status.kind === 'up-to-date') {
        return null;
    }

    const baseClasses = cn(
        'mb-4 flex flex-row items-center justify-between gap-3',
        'border-3 border-border px-4 py-2 shadow-neo',
        'text-xs font-bold uppercase tracking-widest',
    );

    if (status.kind === 'available') {
        return (
            <output
                data-testid="update-banner-available"
                className={cn(baseClasses, 'bg-yellow-300 text-fg')}
            >
                <span>Update {status.version} available.</span>
                <Button size="sm" variant="default" onClick={onInstall}>
                    Install &amp; restart
                </Button>
            </output>
        );
    }

    if (status.kind === 'downloading') {
        const pct = Math.round(status.progress * 100);
        return (
            <output
                data-testid="update-banner-downloading"
                className={cn(baseClasses, 'bg-blue-300 text-fg')}
                aria-live="polite"
            >
                <span>Downloading update… {pct}%</span>
            </output>
        );
    }

    if (status.kind === 'installing') {
        return (
            <output
                data-testid="update-banner-installing"
                className={cn(baseClasses, 'bg-blue-300 text-fg')}
                aria-live="polite"
            >
                <span>Installing update… the app will restart.</span>
            </output>
        );
    }

    // error
    return (
        <div
            data-testid="update-banner-error"
            className={cn(baseClasses, 'bg-red-300 text-fg')}
            role="alert"
        >
            <span>Update failed: {status.message}</span>
            {onDismissError && (
                <Button size="sm" variant="outline" onClick={onDismissError}>
                    Dismiss
                </Button>
            )}
        </div>
    );
}
