import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useId, useState } from 'react';

export interface SettingsUpdatesProps {
    onCheckNow?: () => void;
    onToggleAutoUpdate?: (enabled: boolean) => void;
}

export function SettingsUpdates({ onCheckNow, onToggleAutoUpdate }: SettingsUpdatesProps = {}) {
    const autoId = useId();
    const [auto, setAuto] = useState(true);

    return (
        <Card className="opacity-60" data-coming-soon="true">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Updates</CardTitle>
                <ComingSoonBadge />
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
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onCheckNow?.()}>
                        Check now
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
