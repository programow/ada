---
description: Start the bluemacaw Next.js landing dev server.
---

Start the Next.js 15 landing site in dev mode. Run from the repo root:

```bash
cd packages/landing && bun run dev
```

Expected behavior:

- Next.js dev server starts on http://localhost:3000.
- Hot reload works for the React/TS side and Tailwind class changes.
- Routes available: `/` (home), `/privacy`, `/changelog`.

Do not background the process — the user wants stdout/stderr live and stops the server with Ctrl+C.

## Preflight

Before running, sanity-check the workspace:

```bash
test -f packages/landing/next.config.mjs
test -f packages/landing/package.json
```

If either is missing, abort with: "Not in the bluemacaw repo root, or `packages/landing` is missing."

## When something goes wrong

- **`Module not found` on first run** — run `bun install --frozen-lockfile` from the repo root; the workspace symlinks may be stale.
- **Tailwind classes not applying** — confirm `tailwind.config.ts` `content` globs cover your file; restart the dev server after editing config.
- **Port 3000 in use** — set `PORT=3001 bun run dev`, or kill the conflicting process.
- **Changelog page empty** — the page fetches from `https://api.github.com/repos/programow/vox-era/releases` at build time; in dev it falls back to a graceful empty state when no releases exist yet.
