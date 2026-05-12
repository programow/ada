'use client';

import { type DownloadManifest, fetchManifest } from '@/lib/manifest';
import { useEffect, useState } from 'react';

const RELEASES_FALLBACK = 'https://github.com/programow/ada/releases/latest';

export function Download() {
    const [manifest, setManifest] = useState<DownloadManifest | null>(null);
    const [resolved, setResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchManifest().then((m) => {
            if (cancelled) return;
            setManifest(m);
            setResolved(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const macHref = manifest?.mac ?? (resolved ? null : RELEASES_FALLBACK);
    const winHref = manifest?.win ?? (resolved ? null : RELEASES_FALLBACK);
    const linuxHref = manifest?.linux ?? (resolved ? null : RELEASES_FALLBACK);

    return (
        <section id="download" className="py-16 px-6 max-w-5xl mx-auto">
            <h2 className="text-4xl font-black mb-8">Download for your platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PlatformCard
                    name="macOS"
                    tagline="Signed + notarized DMG"
                    href={macHref}
                    version={manifest?.version}
                />
                <PlatformCard name="Windows" tagline="Unsigned NSIS installer" href={winHref} />
                <PlatformCard
                    name="Linux"
                    tagline="AppImage, deb, rpm — see /install-linux"
                    href={linuxHref}
                />
            </div>
        </section>
    );
}

interface PlatformCardProps {
    name: string;
    tagline: string;
    href: string | null;
    version?: string;
}

function PlatformCard({ name, tagline, href, version }: PlatformCardProps) {
    if (href === null) {
        return (
            <div
                aria-disabled
                className="border-3 border-border shadow-neo-lg p-6 bg-bg block opacity-60"
            >
                <div className="text-2xl font-black">{name}</div>
                <div className="text-sm mt-2">Coming soon</div>
            </div>
        );
    }
    return (
        <a
            href={href}
            className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]"
        >
            <div className="text-2xl font-black">{name}</div>
            <div className="text-sm mt-2">{tagline}</div>
            {version ? <div className="text-xs mt-1 opacity-70">v{version}</div> : null}
        </a>
    );
}
