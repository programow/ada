import { Demo } from '@/components/demo';
import { Download } from '@/components/download';
import { Features } from '@/components/features';
import { Footer } from '@/components/footer';
import { Hero } from '@/components/hero';
import { PrivacyTeaser } from '@/components/privacy-teaser';
import { ProvidersGrid } from '@/components/providers-grid';

export default function HomePage() {
    return (
        <>
            <Hero />
            <Demo />
            <Features />
            <ProvidersGrid />
            <PrivacyTeaser />
            <Download />
            <Footer version="0.0.0" />
        </>
    );
}
