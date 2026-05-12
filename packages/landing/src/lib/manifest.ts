export interface DownloadManifest {
    version: string;
    mac: string | null;
    win: string | null;
    linux: string | null;
}

export const MANIFEST_URL = 'https://github.com/programow/ada/releases/latest/download/latest.json';

export async function fetchManifest(): Promise<DownloadManifest | null> {
    try {
        const res = await fetch(MANIFEST_URL, { headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        return (await res.json()) as DownloadManifest;
    } catch {
        return null;
    }
}
