import './styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The overlay window is rendered into a transparent macOS native window. We
// must clear html + body background colours that globals.css / App.css apply
// for the main window, otherwise the overlay's bg-bg (cream) shows through
// as a solid rectangle around the floating pill.
const params = new URLSearchParams(window.location.search);
if (params.get('window') === 'overlay') {
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.backgroundColor = 'transparent';
}

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element #root not found');
}

ReactDOM.createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
