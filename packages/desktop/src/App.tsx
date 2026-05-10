import { MainWindow } from './windows/main/MainWindow';
import { OverlayApp } from './windows/overlay/OverlayApp';

export default function App() {
    const params = new URLSearchParams(window.location.search);
    const which = params.get('window') ?? 'main';
    if (which === 'overlay') {
        return <OverlayApp />;
    }
    return <MainWindow />;
}
