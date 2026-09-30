# Contributing

Правила одинаковы для людей и ИИ-агентов. Каноническая версия —
[AGENTS.md](./AGENTS.md); этот файл её кратко пересказывает.

## Перед коммитом

```bash
npm run verify   # prettier + eslint + tsc --noEmit + vitest
```

Pre-commit хук (Husky) сделает это за вас на staged-файлах, но `--no-verify` —
не решение: причина сработавшего правила никуда не денется.

## Чеклист

- [ ] `npm run verify` проходит
- [ ] Новая логика покрыта тестом в `test/`, имя файла повторяет `src/`
- [ ] Строгие флаги в `tsconfig.json` не ослаблены
- [ ] Новые env-переменные добавлены в Zod-схему `src/config.ts` и в `.env.example`
- [ ] Новые секреты добавлены в `redact.paths` в `src/logger.ts`
- [ ] `kill_timeout` в `ecosystem.config.cjs` больше `SHUTDOWN_TIMEOUT_MS`
- [ ] Сообщение коммита в conventional-формате

## Строгие флаги TypeScript

В `tsconfig.json` включено больше, чем `strict`. Это осознанно, и ослаблять флаги,
чтобы что-то скомпилировалось, нельзя — правится код.

Самая частая ошибка агентов: `process.env.NODE_ENV` не компилируется из-за
`noPropertyAccessFromIndexSignature`. Правильно — `process.env['NODE_ENV']` или
через Zod-конфиг.

## Коммиты

```bash
git commit -m "feat: add health endpoint"    # ok
git commit -m "test"                        # отклоняется commitlint
```

Проверить заранее: `echo "feat: your message" | npm run commit:lint`.
