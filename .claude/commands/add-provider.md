---
description: Scaffold a new STT provider adapter — registry, tests, docs, landing grid.
---

Arguments: `<provider-id> <Provider Name>` (e.g. `/add-provider acme "Acme Speech"`).

Use OpenAI (`packages/desktop/src/providers/openai.ts`) as the reference template. Every provider is a `ProviderConfig` from `packages/desktop/src/providers/types.ts` and is registered exactly once in the `PROVIDERS` array (alphabetical by `id`).

## Steps

1. **Create the adapter** at `packages/desktop/src/providers/<provider-id>.ts`. It must export a `ProviderConfig` covering:
   - `id`, `name`, `logoSrc`, `docsUrl`, `apiKeyHelpUrl`, `pricingDocsUrl`
   - `makeModel(modelId, apiKey)` — typically a thin wrapper over the provider's Vercel AI SDK package (`@ai-sdk/<id>` or similar)
   - `listModels(apiKey)` — `null` if the provider has no public list endpoint, otherwise an `async` fetch returning `Model[]`
   - `defaultModels: Model[]`
   - `pricing: Record<modelId, { perMinuteUSD, lastUpdated: 'YYYY-MM-DD' }>` — keys must match `defaultModels` ids
2. **Register** in `packages/desktop/src/providers/index.ts` — import it and insert the entry into `PROVIDERS` alphabetically.
3. **Test** at `packages/desktop/src/providers/<provider-id>.test.ts`. The standard contract test asserts: existence in `PROVIDERS`, non-empty `defaultModels`, every `defaultModels[i].id` has a `pricing` entry, every `pricing` entry corresponds to a default model. Cover any non-trivial branch in `listModels` (status codes, response shape).
4. **Logo** at `packages/landing/public/logos/<provider-id>.svg` (reference only — landing lives in Plan C; if the package isn't present yet, skip).
5. **Landing grid** at `packages/landing/src/components/providers-grid.tsx` (Plan C — skip if absent).
6. **Docs**: append a row to `docs/providers.md`'s provider list and update `packages/desktop/README.md`'s provider table.
7. **Trigger doc audit**: run `/sync-docs` to confirm no other doc trigger fires (per `CONTRIBUTING.md`'s trigger table).

## Verify

```bash
cd packages/desktop && bun run test src/providers/<provider-id>.test.ts
bun run typecheck
bun run lint
```

Do not commit until all three are green and `docs/providers.md` is updated.
