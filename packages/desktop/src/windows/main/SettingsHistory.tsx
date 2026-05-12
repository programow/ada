import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    clearAllTranscriptions,
    getRetentionDays,
    purgeOlderThan,
    setRetentionDays,
} from '@/lib/db';
import { useEffect, useId, useState } from 'react';

const OPTIONS = [
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: '365 days (default)' },
    { value: -1, label: 'Forever' },
];

export function SettingsHistory() {
    const retainId = useId();
    const [retainDays, setRetainDays] = useState<number>(365);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        void getRetentionDays().then(setRetainDays);
    }, []);

    async function handleChange(next: number) {
        setRetainDays(next);
        await setRetentionDays(next);
        await purgeOlderThan(next);
    }

    async function handleConfirmClear() {
        await clearAllTranscriptions();
        setConfirming(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={retainId}>Retain transcriptions for</Label>
                    <select
                        id={retainId}
                        className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main/40 focus-visible:border-main"
                        value={String(retainDays)}
                        onChange={(e) => void handleChange(Number(e.target.value))}
                    >
                        {OPTIONS.map((o) => (
                            <option key={o.value} value={String(o.value)}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => setConfirming(true)}>
                        Clear all
                    </Button>
                </div>
                {confirming && (
                    <div className="flex flex-col gap-2 border-3 border-border bg-yellow-100 p-3">
                        <p>This deletes all transcriptions and cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => void handleConfirmClear()}>
                                Confirm
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
