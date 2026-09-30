## What changed

<!-- One or two sentences. What does this PR do, and why does it need to exist? -->

## Checklist

- [ ] `npm run verify` passes locally (format, lint, typecheck, tests)
- [ ] New/changed code has tests in `test/`, filenames mirroring `src/`
- [ ] No strict flags in `tsconfig.json` were relaxed to make something compile
- [ ] New env vars added to the Zod schema in `src/config.ts` and to `.env.example`
- [ ] New secrets added to `redact.paths` in `src/logger.ts`
- [ ] `kill_timeout` in `ecosystem.config.cjs` still exceeds `SHUTDOWN_TIMEOUT_MS`
- [ ] No new runtime dependency without justification below
- [ ] Commit messages follow Conventional Commits

## New dependencies

<!-- List any added packages and why they are needed. Say "none" if empty. -->

None.

## Notes for reviewers

<!-- Anything non-obvious: trade-offs, dead ends, things you decided against. -->
