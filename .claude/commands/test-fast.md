---
description: Run only fast unit tests — skip integration + functional + Rust.
---

Fastest feedback loop. Skips the integration and functional Vitest suites and skips `cargo test` entirely.

```bash
cd packages/desktop && bun run test:unit
```

This runs `vitest run --dir src --exclude '**/integration/**' --exclude '**/functional/**'`. Use it while iterating on a single component or pure function. Run `/test` (full suite) before committing.

If you want vitest's watch mode instead (re-runs on file change), use:

```bash
cd packages/desktop && bun run test:watch
```
