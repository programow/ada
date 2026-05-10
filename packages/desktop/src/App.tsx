import { getHotkeyCombo } from '@/lib/db';
import { vox } from '@/lib/invoke';
import { useEffect } from 'react';
import { MainWindow } from './windows/main/MainWindow';
import { OverlayApp } from './windows/overlay/OverlayApp';

export default function App() {
    const params = new URLSearchParams(window.location.search);
    const which = params.get('window') ?? 'main';
    const isMain = which !== 'overlay';

    useEffect(() => {
        if (!isMain) return;
        void (async () => {
            try {
                const combo = await getHotkeyCombo();
                await vox.registerHotkey(combo);
            } catch (e) {
                console.error('initial registerHotkey failed', e);
            }
        })();
    }, [isMain]);

    if (!isMain) {
        return <OverlayApp />;
    }
    return <MainWindow />;
}
