---
description: Run the desktop test suite with V8 coverage and print the summary.
---

Generate a code-coverage report for the desktop package:

```bash
cd packages/desktop && bun run coverage
```

This runs `vitest run --coverage` using the `@vitest/coverage-v8` provider. Output goes to `packages/desktop/coverage/` (HTML + lcov + text summary).

## Reading the report

- Terminal summary: lines, statements, functions, branches per file.
- HTML drill-down: `open packages/desktop/coverage/index.html`.
- CI machine-readable: `packages/desktop/coverage/lcov.info`.

## Coverage policy (per `docs/testing.md`)

- Provider adapters: 100% on the data-driven contract (id/name/defaultModels/pricing parity).
- `lib/transcribe.ts`: covered end-to-end by `tests/functional/transcribe-flow.test.ts` with MSW v2 handlers.
- React UI components: at minimum a render + interaction test per Settings tab.
- The Rust crate is **not** measured by Vitest coverage — measure it separately with `cargo llvm-cov --lib` if needed.
