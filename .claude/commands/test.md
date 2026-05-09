---
description: Run the full Vox Era test suite (Vitest + Rust unit tests).
---

Run every layer of the test pyramid for the desktop app. Per `docs/testing.md`:

1. Vitest (TS): unit + integration + functional. From the repo root:

```bash
bun run test
```

This fans out to all workspace packages via `bun run --filter '*' test`. For `@vox-era/desktop` it runs `vitest run` over `src/**/*.test.ts(x)` and `tests/**/*.test.ts`.

2. Rust unit tests: from `packages/desktop/src-tauri`:

```bash
cd packages/desktop/src-tauri && cargo test --lib
```

Covers the trait contracts and pure logic (audio enums, secrets vault, history repo against an in-memory SQLite, retention math, etc.). The end-to-end Tauri command surface is exercised by the Vitest functional layer with mocked HTTP, not by `cargo test`.

## Expected output

All three crates green; ~90+ Vitest tests pass in under 5s; cargo tests in well under 30s.

If any test fails, do not paper over it — re-run with `--reporter=verbose` (vitest) or `cargo test --lib -- --nocapture` (Rust) and surface the failure to the user.
