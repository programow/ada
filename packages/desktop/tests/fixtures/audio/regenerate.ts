#!/usr/bin/env bun
// Regenerates the audio fixtures used by Vox Era's tests.
//
// Usage:
//   OPENAI_API_KEY=sk-... bun packages/desktop/tests/fixtures/audio/regenerate.ts
//
// The script first looks at process.env.OPENAI_API_KEY. If that is not set, it
// falls back to reading /Users/guilherme/Dev/programow/ada/config.json and
// extracting the openai_api_key field (the local-dev config used by the legacy
// Electron app). CI is expected to use the env var path.
//
// Generates 3 WAV files via OpenAI TTS (`tts-1`, voice `alloy`) and 2 WAV files
// synthetically (silence + noise) using ./synth.ts. License: TTS outputs are
// usage-licensed under OpenAI's terms; we use them strictly for our own test
// fixtures.

import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode_noise_wav, encode_silence_wav, encode_tone_wav } from './synth';

async function loadApiKey(): Promise<string> {
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey && envKey.length > 0) {
        console.log('[regen] using OPENAI_API_KEY env var');
        return envKey;
    }
    const configPath = '/Users/guilherme/Dev/programow/ada/config.json';
    try {
        const raw = await readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw) as { openai_api_key?: unknown };
        const k = parsed.openai_api_key;
        if (typeof k !== 'string' || k.length === 0) {
            throw new Error(`openai_api_key missing or invalid in ${configPath}`);
        }
        console.log('[regen] using key from ~/Dev/programow/ada/config.json');
        return k;
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Could not load OpenAI API key. Set OPENAI_API_KEY env var or ensure ${configPath} exists with an openai_api_key field. (${reason})`,
        );
    }
}

interface TtsFixture {
    name: string;
    text: string;
    voice?: string;
    fallback: { seconds: number; frequencies: number[] };
}

const TTS_FIXTURES: TtsFixture[] = [
    {
        name: 'hello-world.wav',
        text: 'Hello, world.',
        fallback: { seconds: 1.5, frequencies: [330, 660] },
    },
    {
        name: 'long-speech.wav',
        text: 'This is a longer fixture, used for testing multi-sentence transcription with realistic pacing. The quick brown fox jumps over the lazy dog while the rain falls steadily on the rooftops outside.',
        fallback: { seconds: 9.5, frequencies: [220, 440, 880] },
    },
    {
        name: 'multilingual.wav',
        text: 'Bonjour le monde. Comment allez-vous aujourd’hui ?',
        fallback: { seconds: 4.5, frequencies: [262, 523] },
    },
];

async function fetchTts(
    key: string,
    f: TtsFixture,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; reason: string }> {
    try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: f.text,
                voice: f.voice ?? 'alloy',
                response_format: 'wav',
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '<no body>');
            return { ok: false, reason: `${res.status} ${body.slice(0, 200)}` };
        }
        return { ok: true, bytes: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
}

async function main(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url));
    const allowSynthFallback = process.env.VOX_ERA_ALLOW_SYNTH_FALLBACK === '1';
    const key = await loadApiKey().catch((err) => {
        if (allowSynthFallback) {
            console.warn(`[regen] no API key (${err.message}); falling back to synthetic`);
            return null;
        }
        throw err;
    });

    for (const f of TTS_FIXTURES) {
        let bytes: Buffer | null = null;
        if (key) {
            const result = await fetchTts(key, f);
            if (result.ok) {
                bytes = result.bytes;
                console.log(`[regen] wrote ${f.name} via TTS (${bytes.byteLength} bytes)`);
            } else if (allowSynthFallback) {
                console.warn(`[regen] TTS failed for ${f.name}: ${result.reason}`);
            } else {
                throw new Error(`TTS request failed for ${f.name}: ${result.reason}`);
            }
        }
        if (!bytes) {
            bytes = encode_tone_wav(f.fallback.seconds, 16000, f.fallback.frequencies);
            console.log(`[regen] wrote ${f.name} via synthetic tone (${bytes.byteLength} bytes)`);
        }
        await writeFile(resolve(here, f.name), bytes);
    }

    const silence = encode_silence_wav(2.0, 16000);
    await writeFile(resolve(here, 'silence.wav'), silence);
    console.log(`[regen] wrote silence.wav (${silence.byteLength} bytes)`);

    const noise = encode_noise_wav(2.5, 16000);
    await writeFile(resolve(here, 'noise.wav'), noise);
    console.log(`[regen] wrote noise.wav (${noise.byteLength} bytes)`);
}

await main();
