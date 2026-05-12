# Providers

Vox Era ships nine STT (speech-to-text) providers. The registry is data-driven — every provider is a `ProviderConfig` value, registered exactly once in `packages/desktop/src/providers/index.ts`. There is no provider class, no provider factory, no provider DI container. The whole UI (model picker, pricing display, etc.) reads from the same array.

## Bundled providers

| ID | Name | Default models | Has `listModels` |
|---|---|---|---|
| `assemblyai` | AssemblyAI | `best`, `nano` | static |
| `azure-openai` | Azure OpenAI | deployment-id-based | static |
| `deepgram` | Deepgram | `nova-3`, `nova-2` | static |
| `elevenlabs` | ElevenLabs | `scribe_v1` | live (`/v1/models`) |
| `fal` | Fal | `fal-ai/wizper` | static |
| `gladia` | Gladia | `default` | static |
| `groq` | Groq | `whisper-large-v3-turbo`, `whisper-large-v3`, `distil-whisper-large-v3-en` | live (`/openai/v1/models`) |
| `openai` | OpenAI | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` | live (`/v1/models`) |
| `revai` | Rev AI | `machine`, `human` (async — not yet wired in v1) | static |

(Authoritative source: `packages/desktop/src/providers/*.ts`.)

## The `ProviderConfig` contract

Every provider is a value of this type, defined in `packages/desktop/src/providers/types.ts`:

```ts
export interface ProviderConfig {
    id: string;
    name: string;
    logoSrc: string;
    docsUrl: string;
    apiKeyHelpUrl: string;
    pricingDocsUrl: string;
    makeModel: (modelId: string, apiKey: string) => TranscriptionModel;
    listModels: ((apiKey: string) => Promise<Model[]>) | null;
    defaultModels: Model[];
    pricing: Record<string, PricingEntry>;
    validateKey?: (apiKey: string) => Promise<boolean>;
}
```

Field purposes:

- `id` (kebab-case) — the lookup key. Used as the keychain account name (per [Secrets](secrets.md)) and as the React component key.
- `name` (display) — user-visible name. Title case.
- `logoSrc` — path to the SVG (under `packages/landing/public/logos/<id>.svg` for the landing page; the desktop app reuses the same paths).
- `docsUrl` — link surfaced from the Settings tab "What is this provider?".
- `apiKeyHelpUrl` — link surfaced from the Settings tab "Where do I get a key?".
- `pricingDocsUrl` — link surfaced next to the per-minute pricing column.
- `makeModel(modelId, apiKey)` — returns a `TranscriptionModel` from `ai`. The transcription pipeline (`lib/transcribe.ts`) calls this and hands the result to `experimental_transcribe`. **Just-in-time** key handling: the key is only fetched from the vault at the moment of transcription and lives in the closure for the duration of one HTTP request.
- `listModels(apiKey)` — if the provider exposes a public list endpoint, fetch and filter to known transcription model ids. Returns `null` for providers that don't have such an endpoint; the UI falls back to `defaultModels`.
- `defaultModels` — the canonical list shown when `listModels` is null or has not been called yet. Every entry must have a corresponding key in `pricing`.
- `pricing` — per-minute USD rate. Each entry has a `lastUpdated` ISO date; rates are reviewed on a quarterly cadence (see [Pricing maintenance](#pricing-maintenance)).
- `validateKey` (optional) — a quick check (typically a `GET /v1/models` call) that returns `true` if the key is valid. The Settings UI calls this to confirm a freshly-pasted key.

## `listModels` strategies

Three strategies are in use:

1. **Live filter** (`openai`, `groq`) — fetch the provider's full model list, filter to a hard-coded set of known transcription model ids, and return those. The hard-coded set protects against the model list growing to include irrelevant entries (chat models, embeddings, etc.).
2. **Live raw** (`elevenlabs`) — fetch and return the dedicated transcription endpoint's response.
3. **Static** (`null`) — the provider's API has no list endpoint; rely on `defaultModels`. Most providers are in this bucket.

## Pricing maintenance

Each `pricing[modelId]` has a `lastUpdated` field. Provider rates change occasionally; the canonical update process is:

1. Visit each provider's pricing docs (`pricingDocsUrl`).
2. For any rate that has changed, update `perMinuteUSD` and bump `lastUpdated` to today's ISO date.
3. Run the unit tests — the contract test asserts every `defaultModels[i].id` has a `pricing` entry, so a missing rate trips the build.
4. Commit with `chore(providers): refresh <provider-id> pricing`.
5. Run `/sync-docs` — the trigger table calls out provider rate changes as a doc-update obligation.

## Adding a new provider

Use `/add-provider <id> <Name>` — the slash command walks through every step. The short version:

1. Create `packages/desktop/src/providers/<id>.ts` from `openai.ts` as a template.
2. Register in `packages/desktop/src/providers/index.ts` (alphabetical).
3. Write the contract test at `<id>.test.ts`.
4. Add a logo SVG (Plan C — landing).
5. Update this doc's table.
6. Update `packages/desktop/README.md`'s provider table.
7. Run `/test`, `/typecheck`, `/lint`.

## Spec cross-reference

- §6.7 — Provider registry data-driven contract, listModels strategies, pricing maintenance.
