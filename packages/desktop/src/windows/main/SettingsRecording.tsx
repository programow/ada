import { HotkeyInput } from '@/components/HotkeyInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    clearOriginalFnUsageType,
    getHotkeyCombo,
    getOriginalFnUsageType,
    getSelectedMicDeviceId,
    setHotkeyCombo,
    setOriginalFnUsageType,
    setSelectedMicDeviceId,
} from '@/lib/db';
import { type AudioDeviceInfo, vox } from '@/lib/invoke';
import { useCallback, useEffect, useId, useState } from 'react';

const FN_USAGE_LABEL: Record<number, string> = {
    0: 'Do Nothing',
    1: 'Change Input Source',
    2: 'Show Emoji & Symbols',
    3: 'Start Dictation',
};

function fnUsageLabel(value: number): string {
    return FN_USAGE_LABEL[value] ?? `Unknown (${value})`;
}

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
    /**
     * When non-null, the user has clicked "Use Fn" but the macOS
     * `AppleFnUsageType` setting is something other than 0 ("Do Nothing"),
     * so we surface a confirmation panel before mutating a global system
     * setting. `previous` captures the value to persist as the
     * restore-on-revert target.
     */
    const [pendingFnSetup, setPendingFnSetup] = useState<{ previous: number } | null>(null);

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
        const previousCombo = hotkey;
        setHotkey(combo);
        await setHotkeyCombo(combo);
        // If the user is moving AWAY from Fn back to a standard combo and we
        // previously stashed their original AppleFnUsageType, restore it now
        // so we don't leave the system setting in our state forever.
        if (previousCombo.trim().toLowerCase() === 'fn' && combo.trim().toLowerCase() !== 'fn') {
            try {
                const original = await getOriginalFnUsageType();
                if (original !== null) {
                    await vox.setFnUsageType(original);
                    await clearOriginalFnUsageType();
                }
            } catch (e) {
                console.error('restore AppleFnUsageType failed', e);
            }
        }
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

    /**
     * User clicked "Use Fn". We need the macOS `AppleFnUsageType` setting to
     * be 0 ("Do Nothing") so the Fn key fires `FlagsChanged` events instead
     * of getting consumed by the system input-source switcher / emoji popup
     * / dictation. If it's already 0, register Fn directly; otherwise show a
     * confirmation panel and let the user decide.
     */
    async function handleUseFnRequested() {
        setHotkeyError(null);
        try {
            const current = await vox.getFnUsageType();
            if (current === null || current === 0) {
                await handleHotkeyChange('Fn');
                return;
            }
            setPendingFnSetup({ previous: current });
        } catch (e) {
            setHotkeyError(e instanceof Error ? e.message : String(e));
        }
    }

    async function handleConfirmFnSetup() {
        if (!pendingFnSetup) return;
        try {
            // Stash the original BEFORE writing 0, so a crash mid-flow
            // leaves us a record we can restore from on next launch.
            await setOriginalFnUsageType(pendingFnSetup.previous);
            await vox.setFnUsageType(0);
            setPendingFnSetup(null);
            await handleHotkeyChange('Fn');
        } catch (e) {
            setHotkeyError(e instanceof Error ? e.message : String(e));
        }
    }

    function handleCancelFnSetup() {
        setPendingFnSetup(null);
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
                            onUseFnRequested={() => void handleUseFnRequested()}
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
                    {pendingFnSetup && (
                        <div
                            data-testid="fn-setup-confirm"
                            className="flex flex-col gap-2 border-3 border-border bg-yellow-100 p-3"
                        >
                            <p>
                                To use Fn, macOS needs <strong>Press 🌐 key to</strong> set to{' '}
                                <strong>Do Nothing</strong> (currently:{' '}
                                <strong>{fnUsageLabel(pendingFnSetup.previous)}</strong>). This is a
                                global system setting. Vox Era will restore your original value
                                automatically when you switch away from Fn.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleCancelFnSetup}>
                                    Cancel
                                </Button>
                                <Button onClick={() => void handleConfirmFnSetup()}>
                                    Set automatically
                                </Button>
                            </div>
                        </div>
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
