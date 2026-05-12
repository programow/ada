import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Vox Era — cross-platform speech-to-text',
    description: 'Multi-provider STT desktop app with BYOK and OS-keychain storage.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
