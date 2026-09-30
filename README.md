# node_boilerplate_psql

Node.js + TypeScript boilerplate: strict-типизация, линтер, тесты, Docker и CI.

## Стек

| Слой           | Что используется                                                |
| -------------- | --------------------------------------------------------------- |
| Runtime        | Node.js 24 LTS, native ESM (`"type": "module"`)                 |
| Язык           | TypeScript 6, `strict` + дополнительные флаги                   |
| Линтер         | ESLint 10 (flat config) + typescript-eslint `strictTypeChecked` |
| Форматирование | Prettier 3                                                      |
| Тесты          | Vitest 5 + `@vitest/coverage-v8`                                |
| Валидация env  | Zod 4                                                           |
| Логи           | Pino 10 (+ pino-pretty в dev)                                   |
| База данных    | PostgreSQL 18, драйвер `pg`                                     |
| ORM            | Drizzle ORM (`drizzle-orm` + `drizzle-kit`)                     |
| Контейнер      | multi-stage Dockerfile на `node:24-alpine`, non-root, tini      |

## Быстрый старт

```bash
npm install
cp .env.example .env
docker compose up -d db     # Postgres, если его ещё нет
npm run dev
```

Сервис поднимется на `http://localhost:3000`, health-check — `GET /health`.

## База данных

Схема живёт в TypeScript, а не в SQL-файлах: Drizzle выводит типы колонок
прямо из деклараций, поэтому кодогенерации и сгенерированного клиента нет.

```ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

`src/db/schema.ts` в boilerplate намеренно пуст — здесь только инструментарий,
доменную модель описываете вы.

| Команда               | Что делает                                                |
| --------------------- | --------------------------------------------------------- |
| `npm run db:generate` | SQL-миграция из изменений схемы в `drizzle/` (коммитится) |
| `npm run db:migrate`  | Применяет миграции к `DATABASE_URL`                       |
| `npm run db:push`     | Синхронизирует схему напрямую, без миграций — только dev  |
| `npm run db:check`    | Проверяет целостность цепочки миграций                    |
| `npm run db:studio`   | GUI для просмотра данных                                  |

Схема и миграции должны быть в одном коммите: CI заново генерирует миграцию и падает,
если появился diff — расхождение не попадёт в main.

`drizzle.config.ts` читает `DATABASE_URL` из окружения, а npm-скрипты подгружают `.env`
через `node --env-file-if-exists`. В Docker-образ миграции не копируются: `drizzle-kit`
это dev-зависимость, а образ и так остаётся без неё. Применяйте миграции из CI
или с хоста, до раскатки новой версии.

### Слой доступа

| Файл               | Ответственность                                           |
| ------------------ | --------------------------------------------------------- |
| `src/db/schema.ts` | Таблицы. Единственное место, где объявляется форма данных |
| `src/db/pool.ts`   | `pg.Pool` из конфига, обработчик ошибок на idle-клиенте   |
| `src/db/client.ts` | `drizzle({ client: pool })` + `ping` / `close`            |
| `src/db/health.ts` | Пинг БД и сборка отчёта для `/health`                     |

`createDatabase` возвращает `{ pool, db, ping, close }`. `db` — типизированный
экземпляр Drizzle, `db.$client` — исходный пул, если понадобится сырой SQL.

## Health-check и отказоустойчивость

`GET /health` пингует базу и отвечает в зависимости от `DB_REQUIRED`:

| Ситуация      | `DB_REQUIRED=true` | `DB_REQUIRED=false` |
| ------------- | ------------------ | ------------------- |
| БД доступна   | `200 ok`           | `200 ok`            |
| БД недоступна | `503 error`        | `200 degraded`      |

```json
{ "status": "ok", "checks": { "database": { "state": "up", "latencyMs": 2 } } }
```

Причина сбоя в ответе намеренноgeneric — `ping_failed`, а не текст ошибки драйвера,
где могут быть хост, имя БД и часть строки подключения. Подробности пишутся в лог.

`DB_REQUIRED=true` (по умолчанию) означает две вещи: при старте процесс проверяет
соединение и падает, если базы нет, и `/health` возвращает 503 при падении базы.
Для инстанса под оркестратором это правильное поведение — контейнер уходит в рестарт,
а не продолжает принимать трафик, который не обработает.

Пул закрывается после graceful shutdown: сначала дожидаются закрытия HTTP-листенера,
затем `pool.end()`. Порядок важен — иначе соединение оборвётся под in-flight запросами.

## Скрипты

| Команда                 | Назначение                             |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | Запуск с hot-reload (tsx watch)        |
| `npm run build`         | Компиляция в `dist/`                   |
| `npm start`             | Запуск собранного билда                |
| `npm run typecheck`     | `tsc --noEmit`                         |
| `npm run lint` / `:fix` | ESLint                                 |
| `npm run format`        | Prettier --write                       |
| `npm test`              | Тесты                                  |
| `npm run test:watch`    | Тесты в watch-режиме                   |
| `npm run test:coverage` | Тесты + coverage c порогами            |
| `npm run verify`        | format:check → lint → typecheck → test |
| `npm run clean`         | Удаление `dist/` и `coverage/`         |
| `npm run db:generate`   | Сгенерировать SQL-миграцию из схемы    |
| `npm run db:migrate`    | Применить миграции к `DATABASE_URL`    |
| `npm run db:push`       | Синхронизировать схему напрямую (dev)  |
| `npm run db:check`      | Проверить целостность миграций         |
| `npm run db:studio`     | GUI для данных                         |
| `npm run docker:build`  | Сборка образа                          |
| `npm run docker:run`    | Запуск контейнера с `.env`             |

## Запуск через PM2

Процесс живёт под PM2 в двух режимах: на хосте (VPS) и внутри Docker-контейнера —
конфиг один и тот же, `ecosystem.config.cjs`.

```bash
npm run build        # PM2 запускает dist/index.js, сначала нужен build

npm run pm2:start    # старт в production-режиме
npm run pm2:dev      # старт с NODE_ENV=development и pretty-логами
npm run pm2:status   # таблица процессов
npm run pm2:logs     # живой просмотр логов
npm run pm2:monit    # графики CPU/RAM
npm run pm2:restart  # рестарт с обновлением env (--update-env)
npm run pm2:reload   # zero-downtime reload
npm run pm2:stop     |  npm run pm2:delete  |  npm run pm2:kill
npm run pm2:flush    # очистить логи
```

Логи пишутся в `logs/out.log` и `logs/error.log` (папка в `.gitignore`).
Директория создаётся PM2 автоматически.

Ключевые настройки процесса:

| Параметр             | Значение               | Зачем                                                |
| -------------------- | ---------------------- | ---------------------------------------------------- |
| `instances`          | `1`, `exec_mode: fork` | без кластера — предсказуемый shutdown                |
| `autorestart`        | `true`                 | перезапуск при падении                               |
| `max_restarts`       | `10`                   | защита от бесконечного цикла падений                 |
| `min_uptime`         | `20s`                  | падение быстрее 20s не считается рестартом           |
| `restart_delay`      | `2000`                 | пауза перед рестартом                                |
| `max_memory_restart` | `300M`                 | перезапуск при утечке памяти                         |
| `kill_timeout`       | `15000`                | > `SHUTDOWN_TIMEOUT_MS`, чтобы успеть закрыть сервер |

> `kill_timeout` намеренно больше `SHUTDOWN_TIMEOUT_MS` из `src/config.ts`: иначе PM2
> пришлёт `SIGKILL` раньше, чем приложение успеет завершить запросы. Связь между
> этими значениями проверяется тестом `test/pm2.test.ts`.

### Внутри Docker

Контейнер запускает `pm2-runtime` — демон не поднимается, а процесс живёт в foreground
и корректно получает `SIGTERM` от Docker. Логи перенаправляются в stdout/stderr
(переменная `LOG_TO_STDOUT=true`), поэтому `docker logs` и сборщики логов работают
как обычно, несмотря на PM2. Перезапуски при падении делает сам PM2, а не
`restart: unless-stopped` в compose.

## Конфигурация

Все переменные окружения валидируются Zod в `src/config.ts` — при ошибке процесс падает
на старте с понятным сообщением, а не в рантайме.

| Переменная                                                              | Тип                                     | По умолчанию                   |
| ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------ |
| `NODE_ENV`                                                              | `development` \| `test` \| `production` | `development`                  |
| `LOG_LEVEL`                                                             | `trace`…`fatal`                         | `info`                         |
| `SERVICE_NAME`                                                          | string                                  | `node_boilerplate_psql`        |
| `HOST`                                                                  | string                                  | `0.0.0.0`                      |
| `PORT`                                                                  | 1–65535                                 | `3000`                         |
| `SHUTDOWN_TIMEOUT_MS`                                                   | положительное целое                     | `10000`                        |
| `API_TOKEN`                                                             | string (опционально)                    | —                              |
| `DATABASE_URL`                                                          | корректный URL                          | **обязателен**                 |
| `DATABASE_POOL_MAX`                                                     | 1–100                                   | `10`                           |
| `DATABASE_IDLE_TIMEOUT_MS`                                              | целое ≥ 0                               | `30000`                        |
| `DATABASE_CONNECT_TIMEOUT_MS`                                           | целое ≥ 0                               | `5000`                         |
| `DATABASE_STATEMENT_TIMEOUT_MS`                                         | целое ≥ 0                               | `10000`                        |
| `DATABASE_SSL`                                                          | `true` \| `false`                       | `false`                        |
| `DB_REQUIRED`                                                           | `true` \| `false`                       | `true`                         |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | compose                                 | `app` / `app` / `app` / `5432` |

`DATABASE_URL` обязателен: без него процесс падает на старте с сообщением
`Invalid environment configuration: - DATABASE_URL: must be a valid connection URL`.
PM2 и `npm run dev`/`npm start` подгружают `.env` сами, экспортировать переменные
вручную не нужно.

`DATABASE_SSL=true` нужен для управляемых баз (RDS, Neon, Supabase), которые
требуют TLS. `POSTGRES_*` читает только сервис `db` в compose, чтобы собрать
из них `DATABASE_URL` для контейнера приложения.

Пример — `.env.example`. Файл `.env` в git не попадает.

## Структура

```
src/
  index.ts        точка входа, graceful shutdown по SIGINT/SIGTERM
  config.ts       схема и валидация env
  logger.ts       фабрика Pino с redact секретов
  server.ts       HTTP-сервер и /health
  db/
    schema.ts     таблицы Drizzle
    pool.ts       pg.Pool из конфига
    client.ts     drizzle-клиент, ping, close
    health.ts     пинг БД и отчёт для /health
test/             юнит- и интеграционные тесты
drizzle/          сгенерированные SQL-миграции (в git)
drizzle.config.ts конфиг drizzle-kit
ecosystem.config.cjs   конфиг PM2 (общий для хоста и контейнера)
AGENTS.md             инструкции для агентов (единый источник правды)
CONTRIBUTING.md       те же правила для людей
```

## Docker

```bash
npm run docker:build
npm run docker:run
# или всё вместе с базой
docker compose up --build
```

Compose поднимает два сервиса: `db` (Postgres 18 с healthcheck и именованным
volume) и `app`. Приложение стартует только после того, как `db` станет healthy,
а `DATABASE_URL` собирается из `POSTGRES_*` и указывает на сервис по имени — не
на `localhost`, потому что внутри сети compose это разные машины.

Volume монтируется на `/var/lib/postgresql`, а не на привычный
`/var/lib/postgresql/data`: в PostgreSQL 18 официальный образ перенёс `PGDATA`
в версионную поддиректорию и объявил `VOLUME` на `/var/lib/postgresql`.
Монтирование старого пути привело бы к тому, что данные осели бы в анонимном
томе и пропали бы при пересоздании контейнера.

Образ приложения multi-stage: стадии `deps` → `build` → `prod-deps` → `runtime`.
В рантайме только production-зависимости, непривилегированный пользователь
(`uid 10001`), `tini` как PID 1, встроенный `HEALTHCHECK` и ротация логов в compose.
Точкой входа служит `pm2-runtime` (см. раздел про PM2).

## CI

`.github/workflows/ci.yml` — пять джоб на каждый push и PR в `main`:

1. **verify** — format check, lint, typecheck, тесты с coverage-порогами;
2. **migrations** — `db:check`, проверка что схема и миграции не разошлись,
   применение миграций к настоящему Postgres;
3. **build** — сборка, smoke-тест `node dist/index.js` через `/health` и проверка
   graceful shutdown по `SIGTERM`;
4. **pm2** — реальный старт под PM2, рестарт с новым pid, проверка записи в `logs/`;
5. **docker** — сборка образа с GHA cache и проверка health-check в контейнере.

Джобы 2–5 зависят от `verify`, поэтому сломанный линт не тратит время на сборку образа.
Джобы 2–5 поднимают Postgres как service container: без живой базы нечего проверять —
`/health` вернул бы 503, а `db:migrate` не имел бы куда примениться.
`concurrency` отменяет предыдущий прогон для того же ref, есть `timeout-minutes`
на каждой джобе. Dependabot обновляет npm-зависимости и Actions раз в неделю.

> Проверка graceful shutdown живёт именно в CI: на Windows `Stop-Process` и PM2
> не умеют доставлять `SIGINT`/`SIGTERM` приложению, там возможен только жёсткий kill.

Плюс джоба **commitlint** проверяет conventional-коммиты во всём диапазоне PR.

## Работа с ИИ-агентами

| Файл                              | Кто читает                                                           |
| --------------------------------- | -------------------------------------------------------------------- |
| `AGENTS.md`                       | общий стандарт: Cursor, Codex, Claude Code, Copilot, Windsurf, Aider |
| `.cursor/rules/project.mdc`       | Cursor                                                               |
| `.github/copilot-instructions.md` | GitHub Copilot                                                       |
| `CLAUDE.md`                       | Claude Code                                                          |

`AGENTS.md` — единственный источник правды. Остальные файлы только ссылаются на него,
чтобы правила не расходились между инструментами. Внутри — команды, таблица строгих
флагов TypeScript с объяснением, почему их нельзя отключать ради починки сборки,
и инварианты (например, связь `kill_timeout` и `SHUTDOWN_TIMEOUT_MS`).

`CONTRIBUTING.md` с теми же правилами для людей — см. раздел «Правила» ниже.

MCP-серверы не настроены: если понадобятся, конфиг добавляется в `.mcp.json` — это
отдельный opt-in, в boilerplate держать его незачем.

## Правила для контрибьюторов

### Pre-commit хуки

Husky запускает на staged-файлах:

1. `lint-staged` → prettier + `eslint --fix` (с кэшем);
2. `tsc --noEmit` по всему проекту;
3. `commitlint` — conventional commits.

Цикл обратной связи — секунды вместо ~3 минут ожидания CI. Хуки включаются через
`npm install` (скрипт `prepare`), отдельная настройка не нужна.

```bash
echo "feat: your message" | npm run commit:lint   # проверить сообщение локально
```

Обойти хук (`--no-verify`) — плохая идея: причина, по которой он сработал, никуда не
денется и всплывёт в CI.

### Dependabot

Рутинные minor/patch-обновления npm собираются в один PR вместо десятка. Majors идут
отдельными PR на ревью. Обновление TypeScript до 7.x заблокировано в конфиге: до
выхода `typescript-eslint@9` (peer-диапазон `<6.1.0`) линтер просто не запустится.
Строку `ignore` в `.github/dependabot.yml` нужно удалить после выхода v9.

## Строгий TypeScript

Включены не только `strict`, но и `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `erasableSyntaxOnly`,
`verbatimModuleSyntax`. Это ломает часть кода, который на обычных настройках молча
проходит, — так ошибки не доезжают до прода.

## Лицензия

MIT — см. [LICENSE](./LICENSE).
