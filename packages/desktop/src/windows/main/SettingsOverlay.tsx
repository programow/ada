import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useId, useState } from 'react';

export function SettingsOverlay() {
    const enableId = useId();
    const positionId = useId();
    const [enabled, setEnabled] = useState(true);
    const [position, setPosition] = useState<'top' | 'bottom'>('bottom');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overlay</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex items-center justify-between">
                    <Label htmlFor={enableId}>Enable overlay</Label>
                    <Switch id={enableId} checked={enabled} onCheckedChange={setEnabled} />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={positionId}>Position</Label>
                    <select
                        id={positionId}
                        className="h-10 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo"
                        value={position}
                        onChange={(e) => setPosition(e.target.value as 'top' | 'bottom')}
                    >
                        <option value="bottom">Bottom</option>
                        <option value="top">Top</option>
                    </select>
                </div>
            </CardContent>
        </Card>
    );
}
