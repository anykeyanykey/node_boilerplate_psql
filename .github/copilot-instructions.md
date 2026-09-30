# Copilot instructions

See [AGENTS.md](../AGENTS.md) at the repository root — it is the single source of
truth for conventions, commands and invariants. Do not duplicate it here.

Quick reference:

- Build/test gate: `npm run verify`.
- Do not relax strict flags in `tsconfig.json`; fix the code instead.
- `process.env` access must be `process.env['NAME']` (index-signature rule).
- `enum` is forbidden (`erasableSyntaxOnly`) — use `const` objects with `as const`.
- New code needs tests in `test/` with filenames mirroring `src/`.
- `kill_timeout` (PM2) must stay above `SHUTDOWN_TIMEOUT_MS`.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`,
  `build:`, `ci:`.
