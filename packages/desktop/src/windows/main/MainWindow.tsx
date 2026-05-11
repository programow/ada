import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toast } from '@/components/ui/toast';
import { useHotkeyRecording } from '@/hooks/useHotkeyRecording';
import { listTranscriptions, restoreTranscription, softDeleteTranscription } from '@/lib/db';
import { useOnboardingGate } from '@/lib/use-onboarding-gate';
import { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './Dashboard';
import { History, type HistoryEntry } from './History';
import { OnboardingScreen } from './OnboardingScreen';
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

interface UndoToastState {
    open: boolean;
    rowId: number | null;
}

/**
 * Outer gate — routes the user through onboarding the first time they
 * launch Vox Era on a machine where required permissions are missing,
 * silently bypasses it on every subsequent launch (and on Windows/Linux
 * where everything is usually already granted).
 */
export function MainWindow() {
    const { state, complete } = useOnboardingGate();
    if (state === 'loading') {
        return (
            <main
                className="flex min-h-screen items-center justify-center bg-bg text-fg"
                data-testid="main-loading"
            >
                <p className="text-sm font-medium">Loading…</p>
            </main>
        );
    }
    if (state === 'show-onboarding') {
        return <OnboardingScreen onComplete={complete} />;
    }
    return <MainWindowInner />;
}

/**
 * The original main-window UI — tabs, dashboard, history, settings. Split
 * out from [`MainWindow`] so the gate above can render an alternate tree
 * without running this component's hooks (which would otherwise issue
 * `listTranscriptions` etc. while the user is still on the onboarding
 * screen).
 */
export function MainWindowInner() {
    const { state: recordingState } = useHotkeyRecording();
    const [historyEntries, setHistoryEntries] = useState<readonly HistoryEntry[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [undoToast, setUndoToast] = useState<UndoToastState>({ open: false, rowId: null });

    const loadHistory = useCallback(async () => {
        try {
            const rows = await listTranscriptions({ limit: 200 });
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
    }, []);

    useEffect(() => {
        void loadHistory();
        if (recordingState.kind === 'idle') {
            setRefreshKey((k) => k + 1);
        }
    }, [loadHistory, recordingState.kind]);

    async function handleDelete(rowId: string) {
        const id = Number(rowId);
        if (!Number.isFinite(id)) return;
        await softDeleteTranscription(id);
        await loadHistory();
        setUndoToast({ open: true, rowId: id });
    }

    async function handleUndo() {
        if (undoToast.rowId == null) return;
        await restoreTranscription(undoToast.rowId);
        setUndoToast({ open: false, rowId: null });
        await loadHistory();
    }

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
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>
                <TabsContent
                    value="dashboard"
                    data-testid="panel-dashboard"
                    className="flex flex-col gap-6"
                >
                    <Dashboard refreshKey={refreshKey} />
                    <section className="flex flex-col gap-3" data-testid="section-history">
                        <h2 className="text-xs font-extrabold uppercase tracking-widest opacity-70">
                            Recent transcriptions
                        </h2>
                        <History
                            entries={historyEntries}
                            onDelete={handleDelete}
                            onExportFiltered={() => {}}
                        />
                    </section>
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
            <Toast
                open={undoToast.open}
                message="Transcription deleted."
                duration={5000}
                onClose={() => setUndoToast({ open: false, rowId: null })}
            />
            {undoToast.open && (
                <div className="fixed top-20 right-6 z-50">
                    <Button size="sm" variant="outline" onClick={() => void handleUndo()}>
                        Undo
                    </Button>
                </div>
            )}
        </main>
    );
}
