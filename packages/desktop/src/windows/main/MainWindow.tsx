import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHotkeyRecording } from '@/hooks/useHotkeyRecording';
import { Dashboard } from './Dashboard';
import { History } from './History';
import { RecordingStatusPill } from './RecordingStatusPill';
import { SettingsApiKeys } from './SettingsApiKeys';
import { SettingsHistory } from './SettingsHistory';
import { SettingsModelConfigs } from './SettingsModelConfigs';
import { SettingsOverlay } from './SettingsOverlay';
import { SettingsRecording } from './SettingsRecording';
import { SettingsTheme } from './SettingsTheme';
import { SettingsUpdates } from './SettingsUpdates';

export function MainWindow() {
    const { state: recordingState } = useHotkeyRecording();
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
                    <div className="opacity-60">
                        <Dashboard stats={null} />
                    </div>
                </TabsContent>
                <TabsContent value="history" data-testid="panel-history">
                    <div className="opacity-60">
                        <History entries={[]} />
                    </div>
                </TabsContent>
                <TabsContent
                    value="settings"
                    data-testid="panel-settings"
                    className="flex flex-col gap-6"
                >
                    <SettingsApiKeys />
                    <SettingsModelConfigs />
                    <SettingsRecording devices={[]} />
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
