import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PROVIDERS, type ProviderConfig } from '@/providers';
import { useState } from 'react';

export interface SettingsProvidersProps {
    onSaveKey?: (providerId: string, key: string) => void;
    onToggleActive?: (providerId: string, active: boolean) => void;
    onSelectModel?: (providerId: string, modelId: string) => void;
}

function ProviderCard({
    provider,
    onSaveKey,
    onToggleActive,
    onSelectModel,
}: {
    provider: ProviderConfig;
    onSaveKey?: (providerId: string, key: string) => void;
    onToggleActive?: (providerId: string, active: boolean) => void;
    onSelectModel?: (providerId: string, modelId: string) => void;
}) {
    const [key, setKey] = useState('');
    const [active, setActive] = useState(false);
    const [modelId, setModelId] = useState(provider.defaultModels[0]?.id ?? '');

    return (
        <Card data-testid={`provider-card-${provider.id}`}>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{provider.name}</CardTitle>
                <Switch
                    checked={active}
                    onCheckedChange={(value) => {
                        setActive(value);
                        onToggleActive?.(provider.id, value);
                    }}
                    aria-label={`Activate ${provider.name}`}
                />
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`key-${provider.id}`}>API key</Label>
                    <Input
                        id={`key-${provider.id}`}
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder={`Enter ${provider.name} key`}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`model-${provider.id}`}>Model</Label>
                    <select
                        id={`model-${provider.id}`}
                        className="h-10 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                        value={modelId}
                        onChange={(e) => {
                            setModelId(e.target.value);
                            onSelectModel?.(provider.id, e.target.value);
                        }}
                    >
                        {provider.defaultModels.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.displayName}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        data-action="save"
                        onClick={() => onSaveKey?.(provider.id, key)}
                    >
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function SettingsProviders({
    onSaveKey,
    onToggleActive,
    onSelectModel,
}: SettingsProvidersProps = {}) {
    return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PROVIDERS.map((p) => (
                <ProviderCard
                    key={p.id}
                    provider={p}
                    onSaveKey={onSaveKey}
                    onToggleActive={onToggleActive}
                    onSelectModel={onSelectModel}
                />
            ))}
        </section>
    );
}
