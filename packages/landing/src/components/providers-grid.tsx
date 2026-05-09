import Image from 'next/image';

const PROVIDERS = [
    { id: 'assemblyai', name: 'AssemblyAI' },
    { id: 'azure-openai', name: 'Azure OpenAI' },
    { id: 'deepgram', name: 'Deepgram' },
    { id: 'elevenlabs', name: 'ElevenLabs' },
    { id: 'fal', name: 'Fal' },
    { id: 'gladia', name: 'Gladia' },
    { id: 'groq', name: 'Groq' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'revai', name: 'Rev.ai' },
];

export function ProvidersGrid() {
    return (
        <section className="py-16 px-6 max-w-5xl mx-auto">
            <h2 className="text-4xl font-black mb-8">Pick a provider. Bring your key.</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {PROVIDERS.map((p) => (
                    <div
                        key={p.id}
                        className="border-3 border-border shadow-neo p-4 flex flex-col items-center bg-bg"
                    >
                        <Image
                            src={`/logos/${p.id}.svg`}
                            alt={`${p.name} logo`}
                            width={60}
                            height={60}
                        />
                        <span className="mt-3 text-sm font-bold">{p.name}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
