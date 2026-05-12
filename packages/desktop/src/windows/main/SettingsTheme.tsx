import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import { useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface SettingsThemeProps {
    value?: Theme;
    onChange?: (theme: Theme) => void;
}

const OPTIONS: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
];

export function SettingsTheme({ value = 'system', onChange }: SettingsThemeProps = {}) {
    const [theme, setTheme] = useState<Theme>(value);
    return (
        <Card className="opacity-60" data-coming-soon="true">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Theme</CardTitle>
                <ComingSoonBadge />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm font-medium normal-case">
                {OPTIONS.map((opt) => (
                    <label
                        key={opt.value}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                    >
                        <input
                            type="radio"
                            name="theme"
                            value={opt.value}
                            checked={theme === opt.value}
                            onChange={() => {
                                setTheme(opt.value);
                                onChange?.(opt.value);
                            }}
                        />
                        {opt.label}
                    </label>
                ))}
            </CardContent>
        </Card>
    );
}
