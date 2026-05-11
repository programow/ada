import { HotkeyInput } from '@/components/HotkeyInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    getHotkeyCombo,
    getSelectedMicDeviceId,
    setHotkeyCombo,
    setSelectedMicDeviceId,
} from '@/lib/db';
import { type AudioDeviceInfo, vox } from '@/lib/invoke';
import { useCallback, useEffect, useId, useState } from 'react';

export function SettingsRecording() {
    const hotkeyId = useId();
    const deviceId = useId();
    const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [hotkey, setHotkey] = useState<string>('');
    const [testStatus, setTestStatus] = useState<'idle' | 'recording' | 'playing' | 'error'>(
        'idle',
    );
    const [testError, setTestError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [hotkeyError, setHotkeyError] = useState<string | null>(null);

    const refreshDevices = useCallback(async () => {
        try {
            const list = await vox.listAudioInputDevices();
            setDevices(list);
        } catch {
            setDevices([]);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            const [persistedDevice, persistedHotkey] = await Promise.all([
                getSelectedMicDeviceId(),
                getHotkeyCombo(),
            ]);
            setSelectedDevice(persistedDevice ?? '');
            setHotkey(persistedHotkey);
            await refreshDevices();
        })();
    }, [refreshDevices]);

    async function handleDeviceChange(next: string) {
        setSelectedDevice(next);
        await setSelectedMicDeviceId(next === '' ? null : next);
    }

    async function handleHotkeyChange(combo: string) {
        setHotkey(combo);
        await setHotkeyCombo(combo);
        try {
            await vox.registerHotkey(combo);
            setHotkeyError(null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('register_hotkey failed', e);
            if (msg.includes('accessibility-required')) {
                setHotkeyError(
                    'Fn key needs Accessibility permission. Click Open Settings, grant Vox Era, then choose Use Fn again.',
                );
                try {
                    await vox.requestAccessibilityPermission();
                } catch {
                    // requestAccessibilityPermission already opens Settings; if it
                    // throws we keep the inline error visible.
                }
            } else {
                setHotkeyError(msg);
            }
        }
    }

    async function handleCaptureStart() {
        // Free the OS-level shortcut so the webview can see the keydown the
        // user is about to press. `handleHotkeyChange` will re-register it
        // when the new combo lands.
        try {
            await vox.unregisterHotkey();
        } catch (e) {
            console.error('unregister_hotkey failed', e);
        }
    }

    async function handleCaptureCancel() {
        // User aborted capture; restore whatever was registered before.
        try {
            await vox.registerHotkey(hotkey);
        } catch (e) {
            console.error('restore registerHotkey failed', e);
        }
    }

    async function handleTestRecording() {
        setTestStatus('recording');
        setTestError(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        try {
            const sessionId = await vox.startRecording(
                selectedDevice === '' ? undefined : selectedDevice,
            );
            await new Promise((r) => setTimeout(r, 3000));
            const bytes = await vox.stopRecording(sessionId);
            const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setTestStatus('playing');
        } catch (e) {
            setTestError(e instanceof Error ? e.message : String(e));
            setTestStatus('error');
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recording</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={hotkeyId}>Hotkey</Label>
                    <div id={hotkeyId}>
                        <HotkeyInput
                            value={hotkey}
                            onChange={handleHotkeyChange}
                            onCaptureStart={() => void handleCaptureStart()}
                            onCaptureCancel={() => void handleCaptureCancel()}
                        />
                    </div>
                    {hotkeyError && (
                        <p
                            data-testid="hotkey-error"
                            className="text-xs font-bold uppercase tracking-widest text-red-700"
                        >
                            {hotkeyError}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={deviceId}>Microphone</Label>
                    <div className="flex items-center gap-2">
                        <select
                            id={deviceId}
                            className="h-10 flex-1 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                            value={selectedDevice}
                            onChange={(e) => void handleDeviceChange(e.target.value)}
                        >
                            <option value="">System default</option>
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void refreshDevices()}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span data-testid="test-status" className="text-xs uppercase tracking-widest">
                        {testStatus === 'recording' && 'Recording 3s…'}
                        {testStatus === 'playing' && 'Captured. Press play.'}
                        {testStatus === 'error' && `Error: ${testError}`}
                    </span>
                    <Button
                        onClick={() => void handleTestRecording()}
                        disabled={testStatus === 'recording'}
                    >
                        Test recording
                    </Button>
                </div>
                {audioUrl && testStatus === 'playing' && (
                    /* biome-ignore lint/a11y/useMediaCaption: test playback only */
                    <audio src={audioUrl} controls className="w-full" />
                )}
            </CardContent>
        </Card>
    );
}
