---
description: Run TypeScript type-checking across all workspace packages.
---

From the repo root:

```bash
bun run typecheck
```

This runs `bun run --filter '*' typecheck` which fans out to each package. For `@vox-era/desktop` it executes `tsc --noEmit` against the entire `src/` and `tests/` tree. Stub typecheck scripts in the landing and infra packages exit 0 until Plans C/D wire up the real ones.

Expected: zero errors. If `tsc` reports a type error, fix it — do not push past it. The pre-push lefthook gate runs the same command and will block the push.
