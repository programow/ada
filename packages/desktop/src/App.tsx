import { MainWindow } from './windows/main/MainWindow';
import { OverlayWindow } from './windows/overlay/OverlayWindow';

export default function App() {
    const params = new URLSearchParams(window.location.search);
    const which = params.get('window') ?? 'main';
    if (which === 'overlay') {
        return <OverlayWindow state={{ kind: 'idle' }} />;
    }
    return <MainWindow />;
}
