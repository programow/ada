import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface DashboardStats {
    totalWords: number;
    streakDays: number;
    averageWpm: number;
    timeSavedMinutes: number;
    topProvider: string;
    topModel: string;
    estimatedCostUSD: number;
}

export interface DashboardProps {
    stats: DashboardStats | null;
}

const DASH = '—';

function formatNumber(value: number | undefined): string {
    if (value === undefined) return DASH;
    return value.toLocaleString('en-US');
}

function formatCost(value: number | undefined): string {
    if (value === undefined) return DASH;
    return `$${value.toFixed(2)}`;
}

function formatString(value: string | undefined): string {
    if (!value) return DASH;
    return value;
}

export function Dashboard({ stats }: DashboardProps) {
    const s = stats ?? undefined;
    return (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle>Total Words</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-total-words">
                    {formatNumber(s?.totalWords)}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Streak (days)</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-streak">{formatNumber(s?.streakDays)}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Average WPM</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-wpm">{formatNumber(s?.averageWpm)}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Time saved (min)</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-time-saved">
                    {formatNumber(s?.timeSavedMinutes)}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Top Provider</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-top-provider">
                    {formatString(s?.topProvider)}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Top Model</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-top-model">{formatString(s?.topModel)}</CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Estimated Cost</CardTitle>
                </CardHeader>
                <CardContent data-testid="stat-cost">{formatCost(s?.estimatedCostUSD)}</CardContent>
            </Card>
        </section>
    );
}
