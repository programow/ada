import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { UpdaterStatus } from '@/hooks/useUpdater';
import { useId, useState } from 'react';

export interface SettingsUpdatesProps {
    /** Current updater status (defaults to idle when nothing is wired). */
    status?: UpdaterStatus;
    onCheckNow?: () => void;
    onToggleAutoUpdate?: (enabled: boolean) => void;
}

function statusLine(status: UpdaterStatus): string {
    switch (status.kind) {
        case 'idle':
            return 'Click "Check now" to look for updates.';
        case 'checking':
            return 'Checking for updates…';
        case 'up-to-date':
            return 'You’re on the latest version.';
        case 'available':
            return `Update ${status.version} is ready to install.`;
        case 'downloading':
            return `Downloading update… ${Math.round(status.progress * 100)}%`;
        case 'installing':
            return 'Installing update… the app will restart.';
        case 'error':
            return `Last check failed: ${status.message}`;
    }
}

export function SettingsUpdates({
    status = { kind: 'idle' },
    onCheckNow,
    onToggleAutoUpdate,
}: SettingsUpdatesProps = {}) {
    const autoId = useId();
    const [auto, setAuto] = useState(true);
    const checking = status.kind === 'checking';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Updates</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex items-center justify-between">
                    <Label htmlFor={autoId}>Auto-update</Label>
                    <Switch
                        id={autoId}
                        checked={auto}
                        onCheckedChange={(value) => {
                            setAuto(value);
                            onToggleAutoUpdate?.(value);
                        }}
                    />
                </div>
                <p className="text-xs text-muted-foreground" data-testid="updates-status-line">
                    {statusLine(status)}
                </p>
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onCheckNow?.()} disabled={checking}>
                        {checking ? 'Checking…' : 'Check now'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
