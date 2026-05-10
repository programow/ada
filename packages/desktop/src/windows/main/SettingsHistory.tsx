import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useId, useState } from 'react';

export interface SettingsHistoryProps {
    onClear?: () => void;
}

export function SettingsHistory({ onClear }: SettingsHistoryProps = {}) {
    const retainId = useId();
    const [retainDays, setRetainDays] = useState('90');

    return (
        <Card className="opacity-60" data-coming-soon="true">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>History</CardTitle>
                <ComingSoonBadge />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={retainId}>Retain for (days)</Label>
                    <Input
                        id={retainId}
                        type="number"
                        min={1}
                        value={retainDays}
                        onChange={(e) => setRetainDays(e.target.value)}
                    />
                </div>
                <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => onClear?.()}>
                        Clear history
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
