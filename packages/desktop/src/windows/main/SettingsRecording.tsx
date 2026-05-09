import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useId, useState } from 'react';

export interface MicDevice {
    deviceId: string;
    label: string;
}

export interface SettingsRecordingProps {
    devices: readonly MicDevice[];
    hotkey?: string;
    selectedDeviceId?: string;
    onHotkeyChange?: (hotkey: string) => void;
    onDeviceChange?: (deviceId: string) => void;
    onTestRecording?: () => void;
}

export function SettingsRecording({
    devices,
    hotkey: hotkeyProp = 'Cmd+Shift+Space',
    selectedDeviceId,
    onHotkeyChange,
    onDeviceChange,
    onTestRecording,
}: SettingsRecordingProps) {
    const hotkeyId = useId();
    const deviceId = useId();
    const [hotkey, setHotkey] = useState(hotkeyProp);
    const [device, setDevice] = useState(selectedDeviceId ?? devices[0]?.deviceId ?? '');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recording</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm font-medium normal-case">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={hotkeyId}>Hotkey</Label>
                    <Input
                        id={hotkeyId}
                        value={hotkey}
                        onChange={(e) => {
                            setHotkey(e.target.value);
                            onHotkeyChange?.(e.target.value);
                        }}
                        placeholder="e.g. Cmd+Shift+Space"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={deviceId}>Microphone</Label>
                    <select
                        id={deviceId}
                        className="h-10 border-3 border-border bg-bg px-3 text-sm font-bold shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                        value={device}
                        onChange={(e) => {
                            setDevice(e.target.value);
                            onDeviceChange?.(e.target.value);
                        }}
                    >
                        {devices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end">
                    <Button onClick={() => onTestRecording?.()}>Test recording</Button>
                </div>
            </CardContent>
        </Card>
    );
}
