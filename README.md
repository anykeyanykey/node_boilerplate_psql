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
| Контейнер      | multi-stage Dockerfile на `node:24-alpine`, non-root, tini      |

## Быстрый старт

```bash
npm install
cp .env.example .env
npm run dev
```

Сервис поднимется на `http://localhost:3000`, health-check — `GET /health` → `{"status":"ok"}`.

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

| Переменная            | Тип                                     | По умолчанию            |
| --------------------- | --------------------------------------- | ----------------------- |
| `NODE_ENV`            | `development` \| `test` \| `production` | `development`           |
| `LOG_LEVEL`           | `trace`…`fatal`                         | `info`                  |
| `SERVICE_NAME`        | string                                  | `node_boilerplate_psql` |
| `HOST`                | string                                  | `0.0.0.0`               |
| `PORT`                | 1–65535                                 | `3000`                  |
| `SHUTDOWN_TIMEOUT_MS` | положительное целое                     | `10000`                 |
| `API_TOKEN`           | string (опционально)                    | —                       |

Пример — `.env.example`. Файл `.env` в git не попадает.

## Структура

```
src/
  index.ts    точка входа, graceful shutdown по SIGINT/SIGTERM
  config.ts   схема и валидация env
  logger.ts   фабрика Pino с redact секретов
  server.ts   HTTP-сервер и /health
test/         юнит- и интеграционные тесты
ecosystem.config.cjs   конфиг PM2 (общий для хоста и контейнера)
AGENTS.md             инструкции для агентов (единый источник правды)
CONTRIBUTING.md       те же правила для людей
```

## Docker

```bash
npm run docker:build
npm run docker:run
# или
docker compose up --build
```

Образ multi-stage: стадии `deps` → `build` → `prod-deps` → `runtime`.
В рантайме только production-зависимости, непривилегированный пользователь
(`uid 10001`), `tini` как PID 1, встроенный `HEALTHCHECK` и ротация логов в compose.
Точкой входа служит `pm2-runtime` (см. раздел про PM2).

## CI

`.github/workflows/ci.yml` — четыре джобы на каждый push и PR в `main`:

1. **verify** — format check, lint, typecheck, тесты с coverage-порогами;
2. **build** — сборка, smoke-тест `node dist/index.js` через `/health` и проверка
   graceful shutdown по `SIGTERM`;
3. **pm2** — реальный старт под PM2, рестарт с новым pid, проверка записи в `logs/`;
4. **docker** — сборка образа с GHA cache и проверка health-check в контейнере.

Джобы 2–4 зависят от `verify`, поэтому сломанный линт не тратит время на сборку образа.
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
