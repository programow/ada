# Vox Era — Plan C: Landing Page v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js static landing page with neobrutalism aesthetic, three routes (`/`, `/privacy`, `/changelog`), provider showcase, build-time changelog fetch from GitHub releases, Vitest + Playwright tests, and PR preview workflow.

**Architecture:** Next.js 15+ App Router with `output: "export"` for static SSG. Tailwind + shadcn/ui themed via neobrutalism.dev component variants (hard borders, offset shadows, bold colors). No backend — fully static. Build-time GitHub releases fetch for changelog data. Deployed to S3 + CloudFront (infra setup in Plan D); PR previews to a per-PR S3 prefix.

**Tech Stack:** Next.js 15+, React 18+, TypeScript, Tailwind CSS, shadcn/ui (`shadcn@latest` CLI), neobrutalism.dev components, Biome, Vitest + happy-dom, Playwright, Bun.

**Depends on:** Plan A (monorepo bootstrap, tooling, base CI).
**Independent of:** Plan B (desktop app — runs in parallel).
**Blocked by for production launch:** Plan D (AWS infra + production deploy).

---

## Section 1: Next.js scaffold + Tailwind + shadcn + neobrutalism

### Task 1: Scaffold Next.js inside `packages/landing` via `create-next-app`

**Files (created by the scaffold tool, then customized):**
- All `packages/landing/*` (next.config.mjs, tsconfig.json, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, .gitignore, package.json, postcss.config.mjs, tailwind.config.ts)

**Approach:** use the official `create-next-app` scaffold tool with our preferred flags, then add Vitest/Playwright on top. Faster, fewer errors, aligned with current Next.js 15 defaults.

**Steps:**

- [ ] **Step 1: Remove the placeholder package skeleton (created in Plan A) so the scaffold tool can write fresh**

```bash
rm -rf packages/landing
```

- [ ] **Step 2: Run the official Next.js scaffolder**

```bash
cd packages
bunx create-next-app@latest landing \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-bun \
  --no-eslint \
  --skip-install \
  --turbopack
cd ..
```
Expected: `packages/landing/` is created with Next.js 15+ App Router scaffold, TypeScript, Tailwind CSS, `src/` directory, `@/*` alias.

- [ ] **Step 3: Customize `packages/landing/package.json`** (scaffold writes a minimal one; we replace with our scripts + Vitest + Playwright deps)

```json
{
  "name": "@vox-era/landing",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --dir src",
    "test:e2e": "playwright test",
    "test:e2e:install": "playwright install --with-deps"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: Install**

Run: `bun install`
Expected: deps resolve.

- [ ] **Step 5: Replace `packages/landing/next.config.mjs`** (scaffold writes a default; we add `output: 'export'` + trailing slash)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images: { unoptimized: true },
    trailingSlash: true,
};

export default nextConfig;
```

- [ ] **Step 6: Replace `packages/landing/tsconfig.json`** (extend our root base config)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out", ".next"]
}
```

- [ ] **Step 7: Verify `packages/landing/.gitignore`** (scaffold writes a Next.js-friendly one; confirm or replace)

```
.next/
out/
next-env.d.ts
node_modules/
playwright-report/
test-results/
```

- [ ] **Step 8: Replace the scaffold's `src/app/` files with our placeholders** (Tasks 5–11 build out the real content)

Replace `packages/landing/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Vox Era — cross-platform speech-to-text',
    description: 'Multi-provider STT desktop app with BYOK and OS-keychain storage.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
```

Create `packages/landing/src/app/page.tsx`:

```tsx
export default function Home() {
    return <main>Vox Era — placeholder home page (Plan C builds this out)</main>;
}
```

Create `packages/landing/src/app/globals.css` (Tailwind directives only for now — expanded in Task 3):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Verify**

Run: `cd packages/landing && bun run typecheck && bun run build`
Expected: typecheck passes; `next build` exports static HTML to `out/`.

- [ ] **Step 10: Commit**

```bash
git add packages/landing/
git commit -m "feat(landing): scaffold Next.js 15 App Router with static export"
```

---

### Task 2: Tailwind config + neobrutalism palette

**Files:**
- Modify: `packages/landing/tailwind.config.ts` (scaffold wrote a default; we replace with neobrutalism palette)
- Modify: `packages/landing/src/app/globals.css` (scaffold wrote default Tailwind directives; we add neobrutalism CSS variables)

**Note:** the `create-next-app --tailwind` flag in Task 1 already initialized Tailwind, including `tailwind.config.ts` and `postcss.config.mjs`. We just customize.

**Steps:**

- [ ] **Step 1: Replace `tailwind.config.ts`** with our neobrutalism palette

```ts
import type { Config } from 'tailwindcss';

export default {
    darkMode: 'class',
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                main: 'hsl(var(--main))',
                'main-foreground': 'hsl(var(--main-foreground))',
                bg: 'hsl(var(--bg))',
                fg: 'hsl(var(--fg))',
                border: 'hsl(var(--border))',
            },
            borderWidth: { '3': '3px', '5': '5px' },
            boxShadow: {
                neo: '4px 4px 0 0 hsl(var(--border))',
                'neo-lg': '6px 6px 0 0 hsl(var(--border))',
            },
            fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        },
    },
    plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Replace `globals.css` with neobrutalism palette**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --bg: 60 100% 95%;
        --fg: 0 0% 0%;
        --main: 50 100% 65%;
        --main-foreground: 0 0% 0%;
        --border: 0 0% 0%;
    }
    .dark {
        --bg: 240 6% 10%;
        --fg: 0 0% 95%;
        --main: 50 100% 55%;
        --main-foreground: 0 0% 0%;
        --border: 0 0% 0%;
    }
}

@layer base {
    * { border-color: hsl(var(--border)); }
    body {
        background: hsl(var(--bg));
        color: hsl(var(--fg));
        font-family: theme('fontFamily.sans');
    }
}
```

- [ ] **Step 4: Verify build still passes**

Run: `cd packages/landing && bun run build`
Expected: green build.

- [ ] **Step 5: Commit**

```bash
git add packages/landing/tailwind.config.ts packages/landing/postcss.config.js packages/landing/src/app/globals.css
git commit -m "feat(landing): configure Tailwind with neobrutalism palette"
```

---

### Task 3: Initialize shadcn + add neobrutalism components

**Files:**
- Create: `packages/landing/components.json`
- Create: `packages/landing/src/lib/utils.ts`
- Create: `packages/landing/src/components/ui/*` (shadcn primitives)

**Steps:**

- [ ] **Step 1: Run shadcn init**

```bash
cd packages/landing && bunx shadcn@latest init --defaults
```

Accept defaults; this writes `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2: Add the components used by the landing**

```bash
cd packages/landing && bunx shadcn@latest add button card badge separator
```

Expected: `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx` written.

Note: per https://www.neobrutalism.dev/docs/installation, the CSS variables in `globals.css` (Task 2) deliver the neobrutalism look across all shadcn components automatically. If any component looks off in Tasks 4-9, copy the matching component from neobrutalism.dev into `src/components/ui/` overwriting the shadcn default.

- [ ] **Step 3: Commit**

```bash
git add packages/landing/components.json packages/landing/src/lib/ packages/landing/src/components/
git commit -m "feat(landing): initialize shadcn UI with neobrutalism-themed primitives"
```

---

### Task 4: Vitest + Testing Library setup

**Files:**
- Create: `packages/landing/vitest.config.ts`
- Create: `packages/landing/tests/setup.ts`
- Create: `packages/landing/src/__smoke__/sanity.test.ts`

**Steps:**

- [ ] **Step 1: Failing test**

Create `packages/landing/src/__smoke__/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest sanity', () => {
    it('happy-dom DOM works', () => {
        const div = document.createElement('div');
        div.textContent = 'hi';
        expect(div.textContent).toBe('hi');
    });
});
```

- [ ] **Step 2: Run; fail (no config)**

Run: `cd packages/landing && bun run test`
Expected: FAIL.

- [ ] **Step 3: Add config**

Create `packages/landing/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
    },
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

Create `packages/landing/tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Run; pass**

Run: `cd packages/landing && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/landing/vitest.config.ts packages/landing/tests/ packages/landing/src/__smoke__/
git commit -m "test(landing): configure Vitest with happy-dom"
```

---

## Section 2: Shared layout + Footer + theming

### Task 5: Footer component

**Files:**
- Create: `packages/landing/src/components/footer.tsx`
- Create: `packages/landing/src/components/footer.test.tsx`

**Steps:**

- [ ] **Step 1: Failing test**

Create `packages/landing/src/components/footer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './footer';

describe('Footer', () => {
    it('shows the GitHub link', () => {
        render(<Footer version="0.1.0" />);
        const link = screen.getByRole('link', { name: /github/i });
        expect(link).toHaveAttribute('href', expect.stringContaining('programow/vox-era'));
    });

    it('shows the version', () => {
        render(<Footer version="1.2.3" />);
        expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run; fail**

Run: `cd packages/landing && bun run test src/components/footer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `packages/landing/src/components/footer.tsx`:

```tsx
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
                    <a href="/privacy" className="underline">Privacy</a>
                    <a href="/changelog" className="underline">Changelog</a>
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
```

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/components/footer.tsx packages/landing/src/components/footer.test.tsx
git commit -m "feat(landing): add Footer component with GitHub, privacy, and changelog links"
```

---

## Section 3: Home page components

### Task 6: Hero component

**Files:**
- Create: `packages/landing/src/components/hero.tsx`
- Create: `packages/landing/src/components/hero.test.tsx`

**Steps:**

- [ ] **Step 1: Failing test**

```tsx
// hero.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './hero';

describe('Hero', () => {
    it('renders the headline', () => {
        render(<Hero />);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/speech.to.text/i);
    });

    it('renders a primary download CTA', () => {
        render(<Hero />);
        expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run; fail**

- [ ] **Step 3: Implement**

```tsx
// hero.tsx
import { Button } from './ui/button';

export function Hero() {
    return (
        <section className="py-16 px-6 max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-black leading-tight">
                Speech-to-text that respects your keys, your audio, and your machine.
            </h1>
            <p className="mt-6 text-xl max-w-2xl">
                Press a shortcut. Speak. Get text pasted wherever your cursor is. Bring your own API key for any of 9 STT providers. Open source.
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
```

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/components/hero.tsx packages/landing/src/components/hero.test.tsx
git commit -m "feat(landing): add Hero with headline and download CTA"
```

---

### Task 7: Demo + Features grid + Provider showcase + Privacy teaser + Download buttons

Group the remaining home-page sections into a single task with five subcomponents and one render-test asserting they all appear.

**Files:**
- Create: `packages/landing/src/components/demo.tsx`
- Create: `packages/landing/src/components/features.tsx`
- Create: `packages/landing/src/components/providers-grid.tsx`
- Create: `packages/landing/src/components/privacy-teaser.tsx`
- Create: `packages/landing/src/components/download.tsx`
- Create: `packages/landing/public/demo.gif` (placeholder; replaced post-Plan B)
- Create: `packages/landing/public/logos/{assemblyai,azure-openai,deepgram,elevenlabs,fal,gladia,groq,openai,revai}.svg`
- Create: `packages/landing/src/components/home-sections.test.tsx`

**Steps:**

- [ ] **Step 1: Failing test**

```tsx
// home-sections.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Demo } from './demo';
import { Features } from './features';
import { ProvidersGrid } from './providers-grid';
import { PrivacyTeaser } from './privacy-teaser';
import { Download } from './download';

describe('home sections', () => {
    it('Demo renders the demo image', () => {
        render(<Demo />);
        expect(screen.getByAltText(/recording demo/i)).toBeInTheDocument();
    });

    it('Features renders all 6 cards', () => {
        render(<Features />);
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    });

    it('ProvidersGrid renders all 9 provider names', () => {
        render(<ProvidersGrid />);
        for (const name of ['AssemblyAI', 'Azure OpenAI', 'Deepgram', 'ElevenLabs', 'Fal', 'Gladia', 'Groq', 'OpenAI', 'Rev.ai']) {
            expect(screen.getByText(name)).toBeInTheDocument();
        }
    });

    it('PrivacyTeaser links to /privacy', () => {
        render(<PrivacyTeaser />);
        expect(screen.getByRole('link', { name: /read more/i })).toHaveAttribute('href', '/privacy');
    });

    it('Download renders three platform buttons', () => {
        render(<Download manifest={{ macUrl: '#', winUrl: '#', linuxUrl: '#' }} />);
        expect(screen.getByRole('link', { name: /macOS/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Windows/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Linux/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run; fail**

- [ ] **Step 3: Implement each component**

```tsx
// demo.tsx
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
```

```tsx
// features.tsx
const FEATURES = [
    { title: 'BYOK', body: 'Your API keys live in your OS keychain. No Vox Era backend.' },
    { title: '9 providers', body: 'OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, Fal, Gladia, Azure OpenAI, Rev.ai.' },
    { title: 'Cross-platform', body: 'macOS, Windows, Linux. Same shortcut. Same UX.' },
    { title: 'Open source', body: 'Apache 2.0. Read the code. Verify the privacy story.' },
    { title: 'Auto-update', body: 'Signed updates delivered safely from our update manifest.' },
    { title: 'Cost-aware', body: 'See estimated cost per provider/model right in the dashboard.' },
];

export function Features() {
    return (
        <section className="py-16 px-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {FEATURES.map(f => (
                    <article key={f.title} className="border-3 border-border shadow-neo p-6 bg-main text-main-foreground">
                        <h3 className="text-2xl font-black">{f.title}</h3>
                        <p className="mt-3">{f.body}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
```

```tsx
// providers-grid.tsx
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
                {PROVIDERS.map(p => (
                    <div key={p.id} className="border-3 border-border shadow-neo p-4 flex flex-col items-center bg-bg">
                        <Image src={`/logos/${p.id}.svg`} alt={`${p.name} logo`} width={60} height={60} />
                        <span className="mt-3 text-sm font-bold">{p.name}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
```

```tsx
// privacy-teaser.tsx
export function PrivacyTeaser() {
    return (
        <section className="py-16 px-6 max-w-3xl mx-auto">
            <div className="border-3 border-border shadow-neo-lg p-8 bg-main text-main-foreground">
                <h2 className="text-3xl font-black">Where do your keys live?</h2>
                <p className="mt-4">
                    Your API keys go straight into your OS's native credential store — Keychain on macOS, Credential Manager on Windows, Secret Service on Linux. They never touch a Vox Era server because there isn't one.
                </p>
                <a href="/privacy" className="mt-6 inline-block underline font-bold">Read more &rarr;</a>
            </div>
        </section>
    );
}
```

```tsx
// download.tsx
interface DownloadProps {
    manifest: { macUrl: string; winUrl: string; linuxUrl: string };
}

export function Download({ manifest }: DownloadProps) {
    return (
        <section id="download" className="py-16 px-6 max-w-5xl mx-auto">
            <h2 className="text-4xl font-black mb-8">Download for your platform</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a href={manifest.macUrl} className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]">
                    <div className="text-2xl font-black">macOS</div>
                    <div className="text-sm mt-2">Signed + notarized DMG</div>
                </a>
                <a href={manifest.winUrl} className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]">
                    <div className="text-2xl font-black">Windows</div>
                    <div className="text-sm mt-2">Unsigned NSIS installer</div>
                </a>
                <a href={manifest.linuxUrl} className="border-3 border-border shadow-neo-lg p-6 bg-bg block hover:translate-y-[-2px]">
                    <div className="text-2xl font-black">Linux</div>
                    <div className="text-sm mt-2">AppImage, deb, rpm — see /install-linux</div>
                </a>
            </div>
        </section>
    );
}
```

Create placeholder logo SVGs (any 60×60 source; can be stylized text "OAI" etc. for v1; replace with real logos later, document licensing in `public/logos/README.md`).

Create placeholder `public/demo.gif` (any small GIF; the user records the real one once Plan B is functional).

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/components/ packages/landing/public/
git commit -m "feat(landing): add Demo, Features, ProvidersGrid, PrivacyTeaser, Download sections"
```

---

## Section 4: Privacy page

### Task 8: `/privacy` route

**Files:**
- Create: `packages/landing/src/app/privacy/page.tsx`
- Create: `packages/landing/src/app/privacy/page.test.tsx`

**Steps:**

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPage from './page';

describe('Privacy page', () => {
    it('mentions all three OS keychains', () => {
        render(<PrivacyPage />);
        expect(screen.getByText(/Keychain/)).toBeInTheDocument();
        expect(screen.getByText(/Credential Manager/)).toBeInTheDocument();
        expect(screen.getByText(/Secret Service/)).toBeInTheDocument();
    });

    it('declares zero telemetry', () => {
        render(<PrivacyPage />);
        expect(screen.getByText(/zero telemetry/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run; fail**

- [ ] **Step 3: Implement page** (full content per spec §6.4 threat-model paragraph + §12)

```tsx
import { Footer } from '@/components/footer';

export default function PrivacyPage() {
    return (
        <>
            <main className="max-w-3xl mx-auto px-6 py-16 prose prose-stone">
                <h1>Privacy</h1>
                <p>
                    Vox Era is a desktop app. Your audio and your API keys never touch a Vox Era server because we don't run one.
                </p>
                <h2>API keys</h2>
                <p>
                    Your provider API keys are stored in your OS's native credential storage:
                </p>
                <ul>
                    <li><strong>macOS:</strong> Keychain Services (per-app ACL, hardware-backed on Apple Silicon)</li>
                    <li><strong>Windows:</strong> Credential Manager / DPAPI (per-user, encrypted at rest with your login credentials)</li>
                    <li><strong>Linux:</strong> Secret Service via gnome-keyring or KWallet (per-user, encrypted at rest)</li>
                </ul>
                <p>
                    Keys are fetched only at the moment of transcription, held in memory for the duration of one HTTP request, and never written to disk outside the OS credential store. Keys are never logged, never sent to Vox Era's servers (we don't have any), and the source code path that handles them is open: <code>packages/desktop/src-tauri/src/secrets/</code>.
                </p>
                <h2>Audio</h2>
                <p>
                    Audio is captured by <code>cpal</code> directly from your microphone, sent only to the STT provider you chose, and never persisted by Vox Era.
                </p>
                <h2>History</h2>
                <p>
                    Transcribed text is stored locally in a SQLite database in your app data directory. Default retention is a rolling 1-year window; you can change this or disable history entirely in settings.
                </p>
                <h2>Telemetry</h2>
                <p>
                    <strong>Zero telemetry.</strong> No analytics SDK installed, no error reporting, no usage tracking. If we ever add any of these, it will be opt-in with a settings toggle that defaults off.
                </p>
                <h2>Threat model</h2>
                <p>
                    Any process running as your user account can ask the OS keychain for secrets it knows about — this is a platform-level limitation on Windows and Linux, not specific to Vox Era. macOS Keychain provides stronger per-app isolation. If you require stronger isolation on Windows or Linux, consider running Vox Era under a dedicated user account.
                </p>
                <p>
                    Vox Era is open source under Apache 2.0. If you want to verify any of the above, the code is at <a href="https://github.com/programow/vox-era">github.com/programow/vox-era</a>.
                </p>
            </main>
            <Footer version="0.0.0" />
        </>
    );
}
```

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/app/privacy/
git commit -m "feat(landing): add /privacy page with full security and threat-model explanation"
```

---

## Section 5: Changelog page + GitHub fetch

### Task 9: Build-time GitHub releases fetcher

**Files:**
- Create: `packages/landing/src/lib/github.ts`
- Create: `packages/landing/src/lib/github.test.ts`

**Steps:**

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchReleases } from './github';

vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/releases')) {
        return new Response(JSON.stringify([
            { tag_name: 'v1.0.0', name: 'v1.0.0', body: 'first release', published_at: '2026-01-01T00:00:00Z', html_url: 'https://github.com/x/y/releases/tag/v1.0.0' },
        ]), { status: 200 });
    }
    return new Response('[]', { status: 200 });
}) as typeof fetch);

describe('fetchReleases', () => {
    it('returns parsed releases', async () => {
        const releases = await fetchReleases('programow/vox-era');
        expect(releases).toHaveLength(1);
        expect(releases[0].tag).toBe('v1.0.0');
    });

    it('returns empty array when fetch fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })) as typeof fetch);
        const releases = await fetchReleases('programow/vox-era');
        expect(releases).toEqual([]);
    });
});
```

- [ ] **Step 2: Run; fail**

- [ ] **Step 3: Implement**

```ts
export interface Release {
    tag: string;
    name: string;
    body: string;
    publishedAt: string;
    htmlUrl: string;
}

export async function fetchReleases(repo: string): Promise<Release[]> {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as Array<{
            tag_name: string;
            name: string;
            body: string;
            published_at: string;
            html_url: string;
        }>;
        return data.map(r => ({
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
```

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/lib/github.ts packages/landing/src/lib/github.test.ts
git commit -m "feat(landing): add GitHub releases fetcher with empty-state fallback"
```

---

### Task 10: `/changelog` route

**Files:**
- Create: `packages/landing/src/app/changelog/page.tsx`
- Create: `packages/landing/src/app/changelog/page.test.tsx`

**Steps:**

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChangelogPage from './page';

vi.mock('@/lib/github', () => ({
    fetchReleases: vi.fn(async () => []),
}));

describe('Changelog page', () => {
    it('renders empty state when no releases', async () => {
        const Page = await ChangelogPage();
        render(Page);
        expect(screen.getByText(/no releases yet/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run; fail**

- [ ] **Step 3: Implement**

```tsx
import { fetchReleases } from '@/lib/github';
import { Footer } from '@/components/footer';

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
                        {releases.map(r => (
                            <article key={r.tag} className="border-3 border-border shadow-neo p-6 bg-bg">
                                <h2 className="text-2xl font-black">
                                    <a href={r.htmlUrl} className="underline">{r.name || r.tag}</a>
                                </h2>
                                <time className="text-sm">{new Date(r.publishedAt).toLocaleDateString()}</time>
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
```

- [ ] **Step 4: Run; pass**

- [ ] **Step 5: Commit**

```bash
git add packages/landing/src/app/changelog/
git commit -m "feat(landing): add /changelog page with build-time GitHub fetch and empty state"
```

---

### Task 11: Wire home page to assemble all sections

**Files:**
- Modify: `packages/landing/src/app/page.tsx`

**Steps:**

- [ ] **Step 1: Replace `page.tsx`**

```tsx
import { Hero } from '@/components/hero';
import { Demo } from '@/components/demo';
import { Features } from '@/components/features';
import { ProvidersGrid } from '@/components/providers-grid';
import { PrivacyTeaser } from '@/components/privacy-teaser';
import { Download } from '@/components/download';
import { Footer } from '@/components/footer';

export default function HomePage() {
    return (
        <>
            <Hero />
            <Demo />
            <Features />
            <ProvidersGrid />
            <PrivacyTeaser />
            <Download manifest={{
                macUrl: 'https://github.com/programow/vox-era/releases/latest',
                winUrl: 'https://github.com/programow/vox-era/releases/latest',
                linuxUrl: '/install-linux',
            }} />
            <Footer version="0.0.0" />
        </>
    );
}
```

- [ ] **Step 2: Verify build still works**

Run: `cd packages/landing && bun run build`
Expected: green build; `out/index.html` and `out/privacy/index.html` and `out/changelog/index.html` exist.

- [ ] **Step 3: Commit**

```bash
git add packages/landing/src/app/page.tsx
git commit -m "feat(landing): assemble home page from all sections"
```

---

## Section 6: Tests — Playwright E2E

### Task 12: Playwright config + smoke tests

**Files:**
- Create: `packages/landing/playwright.config.ts`
- Create: `packages/landing/tests/e2e/home.spec.ts`
- Create: `packages/landing/tests/e2e/privacy.spec.ts`
- Create: `packages/landing/tests/e2e/changelog.spec.ts`

**Steps:**

- [ ] **Step 1: Install Playwright**

Run: `cd packages/landing && bun run test:e2e:install`

- [ ] **Step 2: Create config**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    use: { baseURL: 'http://localhost:3000' },
    webServer: {
        command: 'bunx serve out -p 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
```

Add `serve` to devDependencies: `cd packages/landing && bun add -D serve`

- [ ] **Step 3: Write the three spec files**

```ts
// home.spec.ts
import { test, expect } from '@playwright/test';

test('home renders hero, providers, footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/speech.to.text/i);
    await expect(page.locator('text=AssemblyAI')).toBeVisible();
    await expect(page.locator('text=Apache 2.0')).toBeVisible();
});
```

```ts
// privacy.spec.ts
import { test, expect } from '@playwright/test';

test('privacy page mentions OS keychain backends', async ({ page }) => {
    await page.goto('/privacy/');
    await expect(page.locator('text=Keychain')).toBeVisible();
    await expect(page.locator('text=Credential Manager')).toBeVisible();
    await expect(page.locator('text=Secret Service')).toBeVisible();
});
```

```ts
// changelog.spec.ts
import { test, expect } from '@playwright/test';

test('changelog renders empty state when no releases', async ({ page }) => {
    await page.goto('/changelog/');
    await expect(page.locator('h1')).toContainText('Changelog');
});
```

- [ ] **Step 4: Build then run E2E**

Run: `cd packages/landing && bun run build && bun run test:e2e`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/landing/playwright.config.ts packages/landing/tests/e2e/ packages/landing/package.json
git commit -m "test(landing): add Playwright E2E for home, privacy, changelog"
```

---

## Section 7: PR preview workflow + CI integration

### Task 13: PR preview workflow

**Files:**
- Create: `.github/workflows/pr-preview.yml`

**Steps:**

- [ ] **Step 1: Create the workflow**

```yaml
name: PR Preview — Landing

on:
  pull_request:
    paths:
      - 'packages/landing/**'
      - '.github/workflows/pr-preview.yml'

concurrency:
  group: pr-preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  preview:
    name: Build & deploy preview
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Build landing
        run: cd packages/landing && bun run build

      - name: Skip when AWS creds not configured
        if: env.AWS_ACCESS_KEY_ID == ''
        run: |
          echo "AWS_ACCESS_KEY_ID is not set; skipping S3 upload (Plan D provisions infra)."
          exit 0
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}

      - name: Configure AWS credentials
        if: env.AWS_ACCESS_KEY_ID != ''
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}

      - name: Sync to S3 preview prefix
        if: env.AWS_ACCESS_KEY_ID != ''
        run: aws s3 sync packages/landing/out/ s3://vox-era-prod/previews/pr-${{ github.event.pull_request.number }}/ --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}

      - name: Comment preview URL on PR
        if: env.AWS_ACCESS_KEY_ID != ''
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: pr-preview
          message: |
            🔗 **Preview deployed:** https://vox-era.com/previews/pr-${{ github.event.pull_request.number }}/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
```

Note: this workflow is no-op until Plan D provisions the AWS bucket + secrets. Once Plan D lands, the secrets become available and previews deploy automatically.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pr-preview.yml
git commit -m "ci: add landing PR preview workflow (active once Plan D provisions AWS)"
```

---

### Task 14: Add `test-landing` job to base CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**

- [ ] **Step 1: Append a `test-landing` job**

After the `test-desktop` job (added by Plan B) or alongside if Plan B hasn't shipped yet:

```yaml
  test-landing:
    name: Test landing
    needs: [lint-typecheck]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Vitest
        run: cd packages/landing && bun run test
      - name: Build static export
        run: cd packages/landing && bun run build
      - name: Install Playwright
        run: cd packages/landing && bun run test:e2e:install
      - name: Playwright E2E
        run: cd packages/landing && bun run test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test-landing job (Vitest + Playwright)"
```

---

## Section 8: Slash command + landing docs

### Task 15: `/dev-landing` slash command

**Files:**
- Create: `.claude/commands/dev-landing.md`

**Steps:**

- [ ] **Step 1: Create**

```markdown
---
description: Start the Next.js landing dev server.
---

Run from repo root: `cd packages/landing && bun run dev`.

Expected: Next.js dev server starts on http://localhost:3000. Hot reload works for the React side.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/dev-landing.md
git commit -m "feat(claude): add /dev-landing slash command"
```

---

### Task 16: `packages/landing/README.md`

**Files:**
- Create: `packages/landing/README.md`

**Steps:**

- [ ] **Step 1: Create**

```markdown
# @vox-era/landing

The Vox Era marketing + privacy + changelog site. Built with Next.js 15+ App Router, exported statically (`output: 'export'`), themed with Tailwind + shadcn-ui in the neobrutalism palette.

## Develop

```bash
bun run dev          # start at http://localhost:3000
bun run build        # static export to out/
bun run test         # Vitest unit tests
bun run test:e2e     # Playwright against the built out/
```

## Routes

- `/` — home: hero, demo, features, providers, privacy teaser, downloads, footer
- `/privacy` — full privacy and threat-model explanation
- `/changelog` — build-time fetch from `https://api.github.com/repos/programow/vox-era/releases`

## Components

Neobrutalism look comes from `globals.css` (CSS variables) plus shadcn primitives. Add new components via `bunx shadcn@latest add <name>`. If a default shadcn render doesn't match the neobrutal aesthetic, copy the matching component from https://www.neobrutalism.dev/ into `src/components/ui/`.

## Provider grid

The v1 provider list lives in `src/components/providers-grid.tsx`. To add a provider after the desktop app gains support, add a `{ id, name }` entry alphabetically and a logo at `public/logos/<id>.svg`.

## Deploy

- **PR previews:** automatic on push (see `.github/workflows/pr-preview.yml`). Comments preview URL on the PR.
- **Production:** Plan D's release workflow rebuilds + deploys to `s3://vox-era-prod/` on each tagged release.
```

- [ ] **Step 2: Commit**

```bash
git add packages/landing/README.md
git commit -m "docs(landing): add package README"
```

---

### Task 17: Update root docs index for landing

**Files:**
- Modify: `docs/README.md` (add note that landing's own README is the package-level reference)
- Modify: `CLAUDE.md` (already references `packages/landing/`; verify entry mentions Plan C-shipped routes)

**Steps:**

- [ ] **Step 1: Append landing reference to `docs/README.md`** in the relevant section

No new content beyond what Plan A's `docs/README.md` already has — verify the link to `../packages/landing/README.md` resolves and the line item is accurate now that the README exists. If anything is stale, update.

- [ ] **Step 2: Verify CLAUDE.md mentions all 3 landing routes**

If `CLAUDE.md` doesn't already include them, append a line under "Workflows":

```markdown
- **Landing routes:** `/` (home), `/privacy`, `/changelog`
```

- [ ] **Step 3: Commit (if any docs were touched)**

```bash
git add docs/README.md CLAUDE.md
git commit -m "docs(landing): cross-reference landing README from root docs"
```

---

## Plan C complete

At this point:

- [x] Next.js 15+ App Router scaffolded with `output: 'export'`
- [x] Tailwind + shadcn + neobrutalism palette wired up
- [x] Vitest configured for component tests; Playwright configured for E2E against the built static export
- [x] Home page with all 7 sections (Hero, Demo, Features, ProvidersGrid, PrivacyTeaser, Download, Footer)
- [x] `/privacy` page with full security and threat-model explanation
- [x] `/changelog` page with build-time fetch from GitHub releases + graceful empty state
- [x] PR preview workflow ready (no-op until Plan D provisions AWS)
- [x] `test-landing` CI job runs Vitest + Playwright on every PR
- [x] `/dev-landing` slash command
- [x] `packages/landing/README.md` documents the package

**Hand-off:** Plan D provisions AWS infrastructure that activates the PR preview workflow and adds the production deploy step.
