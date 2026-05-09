interface FooterProps {
    version: string;
}

export function Footer({ version }: FooterProps) {
    return (
        <footer className="border-t-3 border-border py-8 px-6 mt-16 text-sm">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
                <div>
                    <span className="font-bold">Vox Era</span> · Apache 2.0 · v{version}
                </div>
                <nav className="flex gap-6">
                    <a href="/privacy" className="underline">
                        Privacy
                    </a>
                    <a href="/changelog" className="underline">
                        Changelog
                    </a>
                    <a
                        href="https://github.com/programow/vox-era"
                        className="underline"
                        rel="noopener noreferrer"
                    >
                        GitHub
                    </a>
                </nav>
            </div>
        </footer>
    );
}
