# Whisper Integration

Ada transcribes audio with [OpenAI Whisper](https://platform.openai.com/docs/api-reference/audio).
All Whisper calls happen in the main process (`main.js`); the renderer
never sees the API key.

## Endpoint

```
POST https://api.openai.com/v1/audio/transcriptions
Authorization: Bearer <key>
Content-Type: multipart/form-data; boundary=<boundary>
```

The response is JSON; on success it contains a `text` field with the
transcript.

## Multipart body construction

The body is built by hand in `main.js` rather than via a library like
`form-data`. This keeps the project zero-runtime-dependency. The body
has exactly two parts:

1. **`file`** — the recorded audio, sent as `audio.webm` with
   `Content-Type: audio/webm`.
2. **`model`** — the model name from `config.json`, e.g. `whisper-1`.

See `main.js` for the exact construction. If you ever need to add a
third field (e.g., `language`, `prompt`, `temperature`), follow the
same pattern: a header block, a value, a `\r\n`, terminated with the
closing `--<boundary>--\r\n`.

## Audio format chain

The bytes that hit Whisper traverse three representations:

```
MediaRecorder (renderer)  →  audio/webm Blob
                          →  ArrayBuffer
                          →  Array.from(Uint8Array)   // serialize for IPC
               IPC → main
                          →  Buffer.from(array)
                          →  appended to multipart body
                          →  POST as audio/webm
```

The IPC hop converts the `Uint8Array` to a plain JavaScript array
because Electron's structured-clone IPC handles arrays cleanly across
the context-isolation boundary. The cost is one extra copy.

## `config.json` schema

```json
{
  "openai_api_key": "sk-...",
  "model": "whisper-1"
}
```

- `openai_api_key` (string, required) — your OpenAI API key.
- `model` (string, required) — Whisper model id. `whisper-1` is the
  only generally-available transcription model at time of writing.

**Never commit `config.json`.** It's in [`.gitignore`](../.gitignore)
for exactly this reason.

## Failure modes

| Symptom | Cause | What the renderer sees |
|---|---|---|
| `data.text` is missing, `data.error` set | Bad/expired API key, wrong model id, malformed multipart | `result.success === false` with `error` from API |
| Network error from `fetch` | Offline, DNS, OpenAI outage | `result.success === false` with `error.message` |
| Empty transcription (`text` is `""` or whitespace) | Mic was muted, recording too short, no speech detected | `result.success === true`, but `text` is empty — paste happens with empty content |
| Hang on "Processing..." | `fetch` timed out without resolving | No `result` returned |

The "empty transcription pastes nothing" case is intentional: Whisper
occasionally returns whitespace for audio it can't transcribe, and
pasting it is harmless. If a future change wants to suppress that,
check `data.text.trim()` in `main.js` before calling `pasteText`.
