import { Button } from './ui/button';

export function Hero() {
    return (
        <section className="py-16 px-6 max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-black leading-tight">
                Speech-to-text that respects your keys, your audio, and your machine.
            </h1>
            <p className="mt-6 text-xl max-w-2xl">
                Press a shortcut. Speak. Get text pasted wherever your cursor is. Bring your own API
                key for any of 9 STT providers. Open source.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild className="text-lg px-6 py-6 shadow-neo-lg border-3">
                    <a href="#download">Download for your OS</a>
                </Button>
                <Button asChild variant="outline" className="text-lg px-6 py-6 shadow-neo border-3">
                    <a href="https://github.com/programow/vox-era">Star on GitHub</a>
                </Button>
            </div>
        </section>
    );
}
