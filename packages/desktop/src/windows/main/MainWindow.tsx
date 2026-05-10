import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHotkeyRecording } from '@/hooks/useHotkeyRecording';
import { listTranscriptions } from '@/lib/db';
import { useEffect, useState } from 'react';
import { Dashboard } from './Dashboard';
import { History, type HistoryEntry } from './History';
import { RecordingStatusPill } from './RecordingStatusPill';
import { SettingsApiKeys } from './SettingsApiKeys';
import { SettingsHistory } from './SettingsHistory';
import { SettingsModelConfigs } from './SettingsModelConfigs';
import { SettingsOverlay } from './SettingsOverlay';
import { SettingsRecording } from './SettingsRecording';
import { SettingsTheme } from './SettingsTheme';
import { SettingsUpdates } from './SettingsUpdates';

function formatCreatedAt(ms: number): string {
    return new Date(ms).toISOString();
}

export function MainWindow() {
    const { state: recordingState } = useHotkeyRecording();
    const [historyEntries, setHistoryEntries] = useState<readonly HistoryEntry[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const rows = await listTranscriptions({ limit: 200 });
                if (cancelled) return;
                setHistoryEntries(
                    rows.map((r) => ({
                        id: String(r.id),
                        text: r.text,
                        provider: r.providerId,
                        model: r.modelId,
                        createdAt: formatCreatedAt(r.createdAt),
                        durationMs: r.durationMs,
                        wordCount: r.wordCount,
                    })),
                );
            } catch (e) {
                console.error('listTranscriptions failed', e);
            }
        }
        void load();
        // Refresh history when a recording finishes (state returns to idle).
        if (recordingState.kind === 'idle') void load();
        return () => {
            cancelled = true;
        };
    }, [recordingState.kind]);
    return (
        <main className="min-h-screen bg-bg p-6 text-fg">
            <header className="mb-6 flex flex-row items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold uppercase tracking-tight">Vox Era</h1>
                    <p className="text-sm font-medium">Multi-provider speech-to-text.</p>
                </div>
                <RecordingStatusPill state={recordingState} />
            </header>
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard" data-testid="panel-dashboard">
                    <Dashboard />
                </TabsContent>
                <TabsContent value="history" data-testid="panel-history">
                    <History entries={historyEntries} />
                </TabsContent>
                <TabsContent
                    value="settings"
                    data-testid="panel-settings"
                    className="flex flex-col gap-6"
                >
                    <SettingsApiKeys />
                    <SettingsModelConfigs />
                    <SettingsRecording />
                    <SettingsOverlay />
                    <SettingsHistory />
                    <SettingsTheme />
                    <SettingsUpdates />
                </TabsContent>
                <TabsContent value="about" data-testid="panel-about">
                    <p className="text-sm opacity-60">About placeholder.</p>
                </TabsContent>
            </Tabs>
        </main>
    );
}
