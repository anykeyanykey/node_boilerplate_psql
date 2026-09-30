# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.

## What this is

A Node.js 24 + TypeScript boilerplate. The service is a small HTTP server with a
`/health` endpoint, env validation via Zod, Pino logging and PM2 process management.
The point of the repo is the **environment**, not the app — keep the environment
working and treat feature code as replaceable.

## Commands

```bash
npm install                # deps
npm run dev                # watch mode on :3000

npm run build              # tsc -> dist/ (required before pm2:start)
npm run verify             # format:check + lint + typecheck + test
npm run test:coverage      # tests with coverage thresholds
npm test                   # single run
npm test -- test/pm2.test.ts   # single file

npm run pm2:start          # start under PM2 (needs dist/, run build first)
npm run pm2:restart        # restart with --update-env
npm run pm2:logs           # tail logs
npm run pm2:kill           # stop the daemon and all apps
```

`npm run verify` is the gate. Run it before you claim a change works.

## Non-negotiable TypeScript settings

`tsconfig.json` enables more than `strict`. These flags are deliberate. **Do not
relax them to make an error go away** — fix the code instead.

| Flag                                 | Why it is on                                          | What it will bite you with                                                   |
| ------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `noUncheckedIndexedAccess`           | `arr[0]` is `T \| undefined`                          | any array or `Record` index access                                           |
| `noPropertyAccessFromIndexSignature` | index signatures need brackets                        | `process.env.FOO` must be `process.env['FOO']`                               |
| `exactOptionalPropertyTypes`         | `{a?: string}` ≠ `{a: string \| undefined}`           | passing `undefined` explicitly to an optional prop                           |
| `erasableSyntaxOnly`                 | output must be runnable without transpilation helpers | `enum`, constructor parameter properties                                     |
| `verbatimModuleSyntax`               | `import type` is mandatory for type-only imports      | plain `import { type Foo } from` is fine, `import { Foo }` for a type is not |
| `noImplicitReturns`                  | every code path must return                           | missing `return` in a branch                                                 |
| `isolatedModules`                    | each file transpiles independently                    | re-exporting types needs `export type`                                       |

## Invariants

These are enforced by tests. If you change one side, change the other, or the
test will fail — that is the point.

- **`kill_timeout` in `ecosystem.config.cjs` must stay above `SHUTDOWN_TIMEOUT_MS`
  in `src/config.ts`.** PM2 sends `SIGKILL` when `kill_timeout` expires. If it is
  smaller, the server gets killed with in-flight requests still open.
  Asserted in `test/pm2.test.ts`.
- **Env vars are validated by Zod in `src/config.ts`.** Add new variables to the
  schema, not to ad-hoc `process.env` reads in feature code. The process is
  supposed to fail fast at startup with a readable message.
- **Secrets are redacted through the Pino config in `src/logger.ts`.** A new
  sensitive variable needs a path added to `redact.paths`, and a line in
  `.env.example`.
- **Coverage thresholds are 90/90/85/90** (statements/functions/branches/lines) in
  `vitest.config.ts`. New code without tests will fail `npm run test:coverage`.

## Adding code

- `src/` is compiled, `test/` is not. Tests live in `test/*.test.ts` and mirror
  the `src/` filename (`src/config.ts` → `test/config.test.ts`).
- Tests import from `../src/x.js` — the `.js` extension is required by
  `moduleResolution: nodenext`. Do not drop it.
- No default exports. Use named exports.
- Do not add dependencies without saying so. Every runtime dependency lands in
  the Docker image and must be justified in the PR description.
- ESLint runs `strictTypeChecked` — no floating promises, no `any`, no unsafe
  member access. `no-console` is on outside `test/` and `*.config.ts`; use the
  Pino logger.

## Platform notes

- **Windows:** `npm.ps1` is blocked by the execution policy — use `npm.cmd`.
  `Stop-Process` and PM2 cannot deliver `SIGINT`/`SIGTERM` to the app here, they
  do a hard kill. Graceful shutdown is therefore only tested in CI on Linux; do
  not "fix" a Windows-only signal failure, it is an OS limitation.
- **Linux/macOS:** `kill -TERM` the pid to verify graceful shutdown.
- The `docker` job in CI is the only place the image is actually built.

## Git

- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`,
  `docs:`, `build:`, `ci:`). Enforced by commitlint on commit and by the
  `commitlint` job in CI.
- `main` is the default branch and is protected by CI, not by branch rules.
- Never commit `.env`. `.env.example` is the template.
- A pre-commit hook runs prettier, eslint and `tsc --noEmit` on staged files.
  Fix what it reports; do not bypass it with `--no-verify` to get a green check.

## Common mistakes

- Adding `enum` → `erasableSyntaxOnly` rejects it. Use a `const` object with
  `as const`.
- Writing `process.env.NODE_ENV` → type error. Use `process.env['NODE_ENV']` or
  the Zod config.
- Running `npm run pm2:start` after editing `src/` without `npm run build` → PM2
  runs stale `dist/`. Use `npm run pm2:restart` and confirm you built first.
- Merging the Dependabot PR that bumps TypeScript to 7.x → `typescript-eslint@8`
  has a peer range of `>=4.8.4 <6.1.0`, lint will not run. Check peer deps before
  merging any major bump.
