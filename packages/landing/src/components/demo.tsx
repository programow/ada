import Image from 'next/image';

export function Demo() {
    return (
        <section className="py-12 px-6 max-w-5xl mx-auto">
            <div className="border-3 border-border shadow-neo-lg overflow-hidden bg-bg">
                <Image
                    src="/demo.gif"
                    alt="Vox Era recording demo: shortcut press, dictation, paste"
                    width={1200}
                    height={675}
                    unoptimized
                />
            </div>
        </section>
    );
}
