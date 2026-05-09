const FEATURES = [
    { title: 'BYOK', body: 'Your API keys live in your OS keychain. No Vox Era backend.' },
    {
        title: '9 providers',
        body: 'OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, Fal, Gladia, Azure OpenAI, Rev.ai.',
    },
    { title: 'Cross-platform', body: 'macOS, Windows, Linux. Same shortcut. Same UX.' },
    { title: 'Open source', body: 'Apache 2.0. Read the code. Verify the privacy story.' },
    { title: 'Auto-update', body: 'Signed updates delivered safely from our update manifest.' },
    { title: 'Cost-aware', body: 'See estimated cost per provider/model right in the dashboard.' },
];

export function Features() {
    return (
        <section className="py-16 px-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {FEATURES.map((f) => (
                    <article
                        key={f.title}
                        className="border-3 border-border shadow-neo p-6 bg-main text-main-foreground"
                    >
                        <h3 className="text-2xl font-black">{f.title}</h3>
                        <p className="mt-3">{f.body}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
