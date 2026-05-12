export function PrivacyTeaser() {
    return (
        <section className="py-16 px-6 max-w-3xl mx-auto">
            <div className="border-3 border-border shadow-neo-lg p-8 bg-main text-main-foreground">
                <h2 className="text-3xl font-black">Where do your keys live?</h2>
                <p className="mt-4">
                    Your API keys go straight into your OS&apos;s native credential store — Keychain
                    on macOS, Credential Manager on Windows, Secret Service on Linux. They never
                    touch a Vox Era server because there isn&apos;t one.
                </p>
                <a href="/privacy" className="mt-6 inline-block underline font-bold">
                    Read more &rarr;
                </a>
            </div>
        </section>
    );
}
