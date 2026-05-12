export interface Release {
    tag: string;
    name: string;
    body: string;
    publishedAt: string;
    htmlUrl: string;
}

interface GithubRelease {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
}

export async function fetchReleases(repo: string): Promise<Release[]> {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as GithubRelease[];
        return data.map((r) => ({
            tag: r.tag_name,
            name: r.name,
            body: r.body,
            publishedAt: r.published_at,
            htmlUrl: r.html_url,
        }));
    } catch {
        return [];
    }
}
