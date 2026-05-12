interface DownloadProps {
    manifest: { macUrl: string; winUrl: string; linuxUrl: string };
}

export function Download({ manifest }: DownloadProps) {
    return (
        <section id="download" className="py-16 px-6 max-w-5xl mx-auto">
            <h2 className="text-4xl font-black mb-8">Download for your platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a
                    href={manifest.macUrl}
                    className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]"
                >
                    <div className="text-2xl font-black">macOS</div>
                    <div className="text-sm mt-2">Signed + notarized DMG</div>
                </a>
                <a
                    href={manifest.winUrl}
                    className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]"
                >
                    <div className="text-2xl font-black">Windows</div>
                    <div className="text-sm mt-2">Unsigned NSIS installer</div>
                </a>
                <a
                    href={manifest.linuxUrl}
                    className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]"
                >
                    <div className="text-2xl font-black">Linux</div>
                    <div className="text-sm mt-2">AppImage, deb, rpm — see /install-linux</div>
                </a>
            </div>
        </section>
    );
}
