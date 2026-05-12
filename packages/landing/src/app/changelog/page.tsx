import { Footer } from '@/components/footer';
import { fetchReleases } from '@/lib/github';

export default async function ChangelogPage() {
    const releases = await fetchReleases('programow/vox-era');
    return (
        <>
            <main className="max-w-3xl mx-auto px-6 py-16">
                <h1 className="text-5xl font-black mb-8">Changelog</h1>
                {releases.length === 0 ? (
                    <p>No releases yet — first release coming soon.</p>
                ) : (
                    <div className="space-y-8">
                        {releases.map((r) => (
                            <article
                                key={r.tag}
                                className="border-3 border-border shadow-neo p-6 bg-bg"
                            >
                                <h2 className="text-2xl font-black">
                                    <a href={r.htmlUrl} className="underline">
                                        {r.name || r.tag}
                                    </a>
                                </h2>
                                <time className="text-sm">
                                    {new Date(r.publishedAt).toLocaleDateString()}
                                </time>
                                <pre className="mt-4 whitespace-pre-wrap font-sans">{r.body}</pre>
                            </article>
                        ))}
                    </div>
                )}
            </main>
            <Footer version="0.0.0" />
        </>
    );
}
