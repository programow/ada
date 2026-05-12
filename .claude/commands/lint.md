---
description: Run Biome lint + format check across the repo.
---

From the repo root:

```bash
bun run lint
```

This is `biome check .` — both the linter (correctness, suspicious, style rules per `biome.json`) and the formatter (whitespace, import organization).

To apply auto-fixes (formatting, organize-imports, safe lints):

```bash
bun run lint:fix
```

Which runs `biome check --write .`. Always re-run `/lint` after `lint:fix` to confirm what's left needs human attention.

## Scope

Biome processes `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.json`, `*.jsonc` files. Rust is not linted by Biome — use `cargo fmt --check` and `cargo clippy` for the Rust crate (run from `packages/desktop/src-tauri`).

Generated files (`packages/*/dist`, `**/target`, `legacy/**`, `docs/superpowers/**`) are excluded via the `files.ignore` block in `biome.json`.
