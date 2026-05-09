import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dashboard } from './Dashboard';

export function MainWindow() {
    return (
        <main className="min-h-screen bg-bg p-6 text-fg">
            <header className="mb-6">
                <h1 className="text-3xl font-extrabold uppercase tracking-tight">Vox Era</h1>
                <p className="text-sm font-medium">Multi-provider speech-to-text.</p>
            </header>
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard" data-testid="panel-dashboard">
                    <Dashboard stats={null} />
                </TabsContent>
                <TabsContent value="history" data-testid="panel-history">
                    <p className="text-sm">History placeholder.</p>
                </TabsContent>
                <TabsContent value="settings" data-testid="panel-settings">
                    <p className="text-sm">Settings placeholder.</p>
                </TabsContent>
                <TabsContent value="about" data-testid="panel-about">
                    <p className="text-sm">About placeholder.</p>
                </TabsContent>
            </Tabs>
        </main>
    );
}
