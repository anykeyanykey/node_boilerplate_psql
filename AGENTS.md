# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.

## What this is

A Node.js 24 + TypeScript boilerplate with PostgreSQL. The service is a small HTTP
server with a `/health` endpoint, env validation via Zod, Pino logging, PM2 process
management and a Drizzle ORM layer. The point of the repo is the **environment**,
not the app — keep the environment working and treat feature code as replaceable.

## Commands

```bash
npm install                # deps
npm run dev                # watch mode on :3000

npm run build              # tsc -> dist/ (required before pm2:start)
npm run verify             # format:check + lint + typecheck + test
npm run test:coverage      # tests with coverage thresholds
npm test                   # single run
npm test -- test/pm2.test.ts   # single file

npm run db:generate        # drizzle schema -> SQL migration in drizzle/
npm run db:migrate         # apply migrations to DATABASE_URL
npm run db:check           # migration chain consistency
npm run db:studio          # data GUI

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

- **Secrets are redacted through the Pino config in `src/logger.ts`.** A new
  sensitive variable needs a path added to `redact.paths`, and a line in
  `.env.example`. Remember that a bare `'FOO'` path only matches a top-level key —
  add the `'*.FOO'` form too or the same secret leaks when logged nested.
- **`kill_timeout` in `ecosystem.config.cjs` must stay above `SHUTDOWN_TIMEOUT_MS`
  in `src/config.ts`.** PM2 sends `SIGKILL` when `kill_timeout` expires. If it is
  smaller, the server gets killed with in-flight requests still open.
  Asserted in `test/pm2.test.ts`.
- **Env vars are validated by Zod in `src/config.ts`.** Add new variables to the
  schema, not to ad-hoc `process.env` reads in feature code. The process is
  supposed to fail fast at startup with a readable message.
- **A schema change and its migration ship in the same commit.** CI re-runs
  `db:generate` and fails if `drizzle/` or `src/db/schema.ts` changes. Never edit
  the generated SQL in `drizzle/` by hand — change the schema and regenerate.
- **The Postgres volume in `docker-compose.yml` is mounted at
  `/var/lib/postgresql`, not `/var/lib/postgresql/data`.** PostgreSQL 18 moved
  `PGDATA` to a versioned subdirectory and declared its `VOLUME` at the parent.
  The old path leaves the real data in an anonymous volume that is discarded when
  the container is recreated.
- **`/health` must never leak the driver error.** `createHealthChecker` returns the
  fixed string `ping_failed`; the underlying error goes to the log. A raw error
  message can contain the host, the database name or part of the connection string.
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

## Database rules

- **Declare tables in `src/db/schema.ts` and nowhere else.** Drizzle infers the
  TypeScript types from those declarations, so a table defined by hand-written SQL
  gives you an untyped escape hatch.
- **Go through `createDatabase(config, logger)` from `src/db/client.ts`.** It owns
  the pool and returns `{ pool, db, ping, close }`. Do not construct a second
  `pg.Pool` in feature code — a second pool means a second set of connections and
  a second shutdown path that nothing closes.
- **Depend on the narrow type when you only need part of the handle.** The health
  checker takes a `Pinger` (`{ ping }`) instead of the whole `DatabaseHandle`,
  which is what makes it testable without a live server. Keep new dependencies
  narrow for the same reason.
- **Never `new Pool()` with a hardcoded URL.** Connection settings come from Zod.
- **`pool.on('error', …)` is not optional.** node-postgres rethrows errors from an
  idle client as an uncaught exception; without the listener in `src/db/pool.ts` a
  database blip becomes a process crash.
- **Close the pool after the HTTP listener, not before.** `src/index.ts` drains
  the server first, then calls `pool.end()`. Reversing that drops in-flight
  requests. `SHUTDOWN_TIMEOUT_MS` has to cover both steps.
- **`DATABASE_URL` is required.** Any code path that calls `loadConfig` needs it in
  the env it passes, including tests. This has already broken
  `test/pm2.test.ts` once.
- The Docker image contains no `drizzle-kit` and no `drizzle/` directory, so
  migrations cannot be applied from inside the container. Run them from CI or the
  host before deploying.

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
- Assuming `npm run dev` or `npm run pm2:start` needs manually exported variables →
  both read `.env` already. Use the npm scripts, not a bare `node dist/index.js`.
- Writing a table in raw SQL and running `db:push` → the schema file and the
  database drift apart and the next `db:generate` produces a nonsense migration.
  Declare the table in `src/db/schema.ts` first.
- Expecting `/health` to stay `200` when the database is gone → with the default
  `DB_REQUIRED=true` a 503 is the designed answer. `200 degraded` only happens
  when you explicitly set `DB_REQUIRED=false`.
