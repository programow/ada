import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getOverlayEnabled, setOverlayEnabled } from '@/lib/db';
import { hideOverlayWindow } from '@/lib/overlay-bridge';
import { useEffect, useId, useState } from 'react';

export function SettingsOverlay() {
    const enableId = useId();
    const [enabled, setEnabled] = useState(true);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const value = await getOverlayEnabled();
            if (cancelled) return;
            setEnabled(value);
            setLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleChange(next: boolean) {
        setEnabled(next);
        await setOverlayEnabled(next);
        if (!next) await hideOverlayWindow();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overlay</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex items-center justify-between">
                    <Label htmlFor={enableId}>Enable overlay</Label>
                    <Switch
                        id={enableId}
                        checked={enabled}
                        disabled={!loaded}
                        onCheckedChange={(v) => void handleChange(v)}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
