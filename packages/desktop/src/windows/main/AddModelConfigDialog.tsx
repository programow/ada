import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { type ApiKeyRow, addModelConfig, listApiKeys } from '@/lib/db';
import { vox } from '@/lib/invoke';
import { type Model, PROVIDERS } from '@/providers';
import { modelPriceLabel, providerName } from '@/providers/util';
import { useEffect, useId, useMemo, useState } from 'react';

interface AddModelConfigDialogProps {
    open: boolean;
    onClose: () => void;
    onAdded: () => void;
}

export function AddModelConfigDialog({ open, onClose, onAdded }: AddModelConfigDialogProps) {
    const apiKeyId = useId();
    const modelId = useId();
    const [keys, setKeys] = useState<ApiKeyRow[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>('');
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const selectedProvider = useMemo(
        () => PROVIDERS.find((p) => p.id === keys.find((k) => k.id === selectedKey)?.providerId),
        [keys, selectedKey],
    );

    useEffect(() => {
        if (!open) return;
        void (async () => {
            const rows = await listApiKeys();
            setKeys(rows);
            setSelectedKey(rows[0]?.id ?? '');
        })();
    }, [open]);

    useEffect(() => {
        if (!selectedKey) {
            setModels([]);
            setSelectedModel('');
            return;
        }
        const apiKey = keys.find((k) => k.id === selectedKey);
        if (!apiKey) return;
        const provider = PROVIDERS.find((p) => p.id === apiKey.providerId);
        if (!provider) return;
        setModels(provider.defaultModels);
        setSelectedModel(provider.defaultModels[0]?.id ?? '');
        if (provider.listModels) {
            void (async () => {
                try {
                    const secret = await vox.getSecret(apiKey.id);
                    if (!secret) return;
                    const dynamic = await provider.listModels?.(secret);
                    if (dynamic && dynamic.length > 0) {
                        setModels(dynamic);
                        const first = dynamic[0];
                        setSelectedModel((current) =>
                            dynamic.some((m) => m.id === current) ? current : (first?.id ?? ''),
                        );
                    }
                } catch {
                    // fall back to defaultModels silently
                }
            })();
        }
    }, [selectedKey, keys]);

    function reset() {
        setSelectedKey('');
        setModels([]);
        setSelectedModel('');
        setError(null);
        setBusy(false);
    }

    async function handleSave() {
        setError(null);
        setBusy(true);
        try {
            if (!selectedKey || !selectedModel) {
                setError('Pick an API key and a model.');
                return;
            }
            await addModelConfig({ apiKeyId: selectedKey, modelId: selectedModel });
            reset();
            onAdded();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    reset();
                    onClose();
                }
            }}
        >
            <DialogContent data-testid="add-model-config-dialog">
                <DialogHeader>
                    <DialogTitle>Add Model Config</DialogTitle>
                    <DialogDescription>Pair an API key with a specific model.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-sm font-medium normal-case">
                    {keys.length === 0 ? (
                        <p className="text-fg/60" data-testid="no-keys-message">
                            Add an API key first.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor={apiKeyId}>API key</Label>
                                <select
                                    id={apiKeyId}
                                    data-testid="api-key-select"
                                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main/40 focus-visible:border-main"
                                    value={selectedKey}
                                    onChange={(e) => setSelectedKey(e.target.value)}
                                >
                                    {keys.map((k) => (
                                        <option key={k.id} value={k.id}>
                                            {k.nickname} ({providerName(k.providerId)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor={modelId}>Model</Label>
                                <select
                                    id={modelId}
                                    data-testid="model-select"
                                    className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main/40 focus-visible:border-main"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                >
                                    {models.map((m) => {
                                        const price = modelPriceLabel(
                                            selectedProvider?.id ?? '',
                                            m.id,
                                        );
                                        return (
                                            <option key={m.id} value={m.id}>
                                                {price
                                                    ? `${m.displayName} · ${price}`
                                                    : m.displayName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </>
                    )}
                    {error && (
                        <p className="text-xs font-bold text-red-700" role="alert">
                            {error}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            reset();
                            onClose();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={busy || keys.length === 0}
                        data-testid="save-model-config"
                    >
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
