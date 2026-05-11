import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ApiKeyRow, listApiKeys } from '@/lib/db';
import { providerName } from '@/providers/util';
import { useCallback, useEffect, useState } from 'react';
import { AddApiKeyDialog } from './AddApiKeyDialog';
import { DeleteApiKeyDialog } from './DeleteApiKeyDialog';

export function SettingsApiKeys() {
    const [keys, setKeys] = useState<ApiKeyRow[]>([]);
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<ApiKeyRow | null>(null);

    const reload = useCallback(async () => {
        setKeys(await listApiKeys());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>API Keys</CardTitle>
                <Button size="sm" onClick={() => setAdding(true)} data-testid="add-api-key">
                    Add API Key
                </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm font-medium normal-case">
                {keys.length === 0 ? (
                    <p className="text-fg/60" data-testid="api-keys-empty">
                        No API keys yet. Add one to get started.
                    </p>
                ) : (
                    keys.map((k) => (
                        <div
                            key={k.id}
                            data-testid={`api-key-row-${k.id}`}
                            className="flex items-center justify-between border-3 border-border bg-bg px-3 py-2"
                        >
                            <div>
                                <div className="text-xs font-bold uppercase tracking-widest">
                                    {providerName(k.providerId)}
                                </div>
                                <div className="text-sm">{k.nickname}</div>
                            </div>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleting(k)}
                                data-testid={`delete-api-key-${k.id}`}
                            >
                                Delete
                            </Button>
                        </div>
                    ))
                )}
            </CardContent>
            <AddApiKeyDialog
                open={adding}
                onClose={() => setAdding(false)}
                onAdded={() => {
                    setAdding(false);
                    void reload();
                }}
            />
            {deleting && (
                <DeleteApiKeyDialog
                    apiKey={deleting}
                    onClose={() => setDeleting(null)}
                    onDeleted={() => {
                        setDeleting(null);
                        void reload();
                    }}
                />
            )}
        </Card>
    );
}
