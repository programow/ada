# Audio fixtures

Used by functional tests in `packages/desktop/tests/functional/`.

| File | Content | Purpose |
|---|---|---|
| `hello-world.wav` | "Hello, world." | Happy path |
| `silence.wav` | 2s digital silence | Edge: no speech |
| `noise.wav` | 2.5s low-amplitude white noise | Edge: noise-only |
| `long-speech.wav` | ~10s multi-sentence English | Long form |
| `multilingual.wav` | Short French sentence | Edge: language detection |

## Provenance

- `hello-world.wav`, `long-speech.wav`, `multilingual.wav`: generated via OpenAI
  TTS (model `tts-1`, voice `alloy`, format `wav`). License: per OpenAI usage
  terms; used here strictly for internal testing.
- `silence.wav`, `noise.wav`: generated synthetically (16-bit PCM mono @ 16 kHz)
  by `synth.ts`.

## Regenerate

The regeneration script tries `OPENAI_API_KEY` first, then falls back to reading
`/Users/guilherme/Dev/programow/ada/config.json` (the legacy Ada Electron app's
local config, gitignored). CI should always use the env var path.

```sh
# Preferred (CI / contributors):
OPENAI_API_KEY=sk-... bun packages/desktop/tests/fixtures/audio/regenerate.ts

# Local dev fallback (uses ~/Dev/programow/ada/config.json automatically):
bun packages/desktop/tests/fixtures/audio/regenerate.ts

# Fully offline / quota-exhausted: synthesize tone-based placeholders for the
# three TTS fixtures (hello-world, long-speech, multilingual) instead of
# calling the API. silence.wav and noise.wav are always synthetic.
VOX_ERA_ALLOW_SYNTH_FALLBACK=1 bun packages/desktop/tests/fixtures/audio/regenerate.ts
```

The script overwrites the WAVs in place. Commit the resulting binaries
alongside any provenance changes so CI sees a stable snapshot.

## Why commit binaries?

These fixtures are <1 MB total and stable. Committing them makes the test
suite deterministic and runnable offline; only contributors who edit fixture
content need a working OpenAI key.

## Note on the bundled fixtures

The WAVs currently committed were generated with `VOX_ERA_ALLOW_SYNTH_FALLBACK=1`
because the OpenAI account hit `insufficient_quota` during the initial
fixture generation. They are tone-based synthetic placeholders, not real
speech. The functional tests don't depend on the audio content being real
speech — provider HTTP responses are mocked via MSW — so this is a stable
state. Re-run the script without the env var to replace them with real TTS
outputs once the quota issue is resolved.

