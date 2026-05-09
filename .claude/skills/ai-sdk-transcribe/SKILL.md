---
name: ai-sdk-transcribe
description: Use when implementing speech-to-text via Vercel AI SDK's experimental_transcribe with multiple provider adapters and just-in-time API key handling
---

# AI SDK transcribe

Vercel AI SDK provides a unified `transcribe` API across STT providers. Validated against https://ai-sdk.dev/docs/ai-sdk-core/transcription as of 2026-05-04.

## Function name (still experimental)

```typescript
import { experimental_transcribe as transcribeAi } from 'ai';
```

The API is still `experimental_` prefixed and may rename when it graduates. Single import in your codebase makes the rename a one-line change. Track AI SDK release notes.

## Provider factory pattern

Each provider exports a `createX({ apiKey })` factory. Calling it returns a provider with a `.transcription(modelId)` method that produces a model bound to the key:

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';

const model = createOpenAI({ apiKey: 'sk-...' }).transcription('whisper-1');
const groqModel = createGroq({ apiKey: 'gsk-...' }).transcription('whisper-large-v3');
```

The factory is the supported path for runtime-configured API keys (vs. env-based singletons).

## Calling transcribe

```typescript
const { text } = await transcribeAi({
    model,
    audio: new Uint8Array(await blob.arrayBuffer()),
});
```

`audio` accepts `Uint8Array`, `ArrayBuffer`, `Buffer`, base64 `string`, or `URL`. Provider handles MIME type detection from format hints.

## Provider list (as of 2026-05-04)

OpenAI, Azure OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, Fal, Gladia, Rev.ai. **Hume and Lmnt are NOT on the list** — don't include them without re-validating.

## Just-in-time API key (BYOK pattern)

For desktop apps with OS-keychain stored keys, fetch key per-call rather than at app start:

```typescript
async function transcribe(audio: Blob): Promise<string> {
    const apiKey = await invoke<string | null>('get_secret', { providerId });
    if (!apiKey) throw new Error('No API key configured');
    const model = provider.makeModel(modelId, apiKey);  // factory inside ProviderConfig
    const { text } = await transcribeAi({
        model,
        audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return text;  // apiKey reference dropped after this scope
}
```

The key lives in webview memory only for the duration of one HTTP request, never persists in TS state.

## Mocking with MSW v2

MSW intercepts at the network layer, so AI SDK runs unmodified in tests:

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
    http.post('https://api.openai.com/v1/audio/transcriptions',
        async () => HttpResponse.json({ text: 'mocked transcript' })),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

MSW v1's `rest` API is replaced by `http` — don't use `rest` in new code.

## Listing models per provider

No unified `provider.listModels()` API. Each provider:
- **OpenAI**: `GET /v1/models` → filter for transcription model IDs
- **Groq**: `GET /openai/v1/models` → filter for whisper/distil
- **ElevenLabs**: `GET /v1/models` → filter
- **Deepgram, AssemblyAI, Gladia, Rev.ai, Fal**: no models endpoint — hardcode current list, document `lastUpdated` date

Pattern: `ProviderConfig.listModels: ((apiKey) => Promise<Model[]>) | null` — null means "use `defaultModels` array."

## Common pitfalls

- **API key cached in webview state across calls** → fetch just-in-time via Tauri command, don't cache in module-level state
- **Audio format mismatch** → most providers accept webm/wav/mp3/m4a; pass raw `Uint8Array`, not Base64 unless docs require
- **Importing wrong provider package** → adapters are `@ai-sdk/<id>`, not `@vercel/ai-sdk-<id>`
- **Empty audio buffer** → providers return 400 with confusing messages; validate `bytes.length > 0` before sending
- **Mocking AI SDK directly with `vi.mock('ai')`** → fragile; mock at HTTP layer with MSW so AI SDK behavior is real

## References

- https://ai-sdk.dev/docs/ai-sdk-core/transcription
- https://ai-sdk.dev/providers
- https://mswjs.io/docs/migrations/1.x-to-2.x
