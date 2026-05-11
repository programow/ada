/**
 * Daily provider smoke test.
 *
 * Iterates the configured PROVIDERS, reads each provider's API key from an
 * env var, and runs one transcription against the canned `hello-world.wav`
 * fixture. Providers whose env var is unset are skipped, not failed — so
 * users can opt in per provider by adding the matching GitHub Secret.
 *
 * Exits 1 if any provider returned a real API error (deprecation, missing
 * parameter, retired model id, etc.). Skipped providers don't count.
 *
 * Intended to be run by `.github/workflows/provider-smoke.yml` on a daily
 * cron — surfaces breaking provider changes before users hit them.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TranscriptionModel } from 'ai';
import { experimental_transcribe as transcribe } from 'ai';
import { PROVIDERS } from '../../src/providers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENV_VAR_BY_PROVIDER: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    assemblyai: 'ASSEMBLYAI_API_KEY',
    deepgram: 'DEEPGRAM_API_KEY',
    elevenlabs: 'ELEVENLABS_API_KEY',
    fal: 'FAL_KEY',
    gladia: 'GLADIA_API_KEY',
    revai: 'REVAI_API_KEY',
    // Azure OpenAI requires a deployment name + resource name, not just an
    // API key, so it's not part of the simple key-only smoke test.
};

interface SmokeResult {
    provider: string;
    status: 'ok' | 'skip' | 'error';
    modelId?: string;
    detail?: string;
    durationMs?: number;
}

async function main() {
    const fixturePath = path.resolve(__dirname, '../fixtures/audio/hello-world.wav');
    const audio = new Uint8Array(await fs.readFile(fixturePath));

    const results: SmokeResult[] = [];

    for (const provider of PROVIDERS) {
        const envVar = ENV_VAR_BY_PROVIDER[provider.id];
        if (!envVar) {
            results.push({
                provider: provider.id,
                status: 'skip',
                detail: 'no env-var mapping (e.g. Azure needs deployment name)',
            });
            continue;
        }
        const apiKey = process.env[envVar];
        if (!apiKey) {
            results.push({
                provider: provider.id,
                status: 'skip',
                detail: `${envVar} not set`,
            });
            continue;
        }
        const modelId = provider.defaultModels[0]?.id;
        if (!modelId) {
            results.push({
                provider: provider.id,
                status: 'skip',
                detail: 'no default model id',
            });
            continue;
        }
        const start = Date.now();
        try {
            const model = provider.makeModel(modelId, apiKey) as TranscriptionModel;
            await transcribe({ model, audio });
            results.push({
                provider: provider.id,
                status: 'ok',
                modelId,
                durationMs: Date.now() - start,
            });
        } catch (e) {
            results.push({
                provider: provider.id,
                status: 'error',
                modelId,
                durationMs: Date.now() - start,
                detail: e instanceof Error ? e.message : String(e),
            });
        }
    }

    // Print as a compact table.
    console.table(
        results.map((r) => ({
            provider: r.provider,
            status: r.status,
            model: r.modelId ?? '',
            ms: r.durationMs ?? '',
            detail: r.detail ?? '',
        })),
    );

    const errors = results.filter((r) => r.status === 'error');
    const ok = results.filter((r) => r.status === 'ok');
    const skipped = results.filter((r) => r.status === 'skip');

    console.log(
        `\nSummary: ${ok.length} ok, ${errors.length} error, ${skipped.length} skipped (${PROVIDERS.length} total).`,
    );

    if (errors.length > 0) {
        console.error(
            `\n❌ ${errors.length} provider(s) failed. Each failure usually means the provider deprecated a parameter or retired a model id; check the messages above and patch the adapter in packages/desktop/src/providers/<id>.ts.`,
        );
        process.exit(1);
    }

    if (ok.length === 0) {
        console.warn(
            '\n⚠  No providers were exercised. Set at least one API key env var to make this test meaningful.',
        );
        // Exit 0 — zero secrets is a config choice, not a test failure.
    }
}

main().catch((e) => {
    console.error('Unhandled error in smoke test:', e);
    process.exit(2);
});
