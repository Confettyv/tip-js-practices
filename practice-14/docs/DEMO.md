# Сценарий итоговой демонстрации

## Паспорт

- Коммит: релизный коммит `practice-14: release 1.0.0` в репозитории `tip-NEW`
  (хеш: `git log -1 --format=%h practice-14-v1.0.0`)
- Тег: `practice-14-v1.0.0` (аннотированный)
- Версия: `1.0.0` (`package.json`, `RELEASE_VERSION`, CHANGELOG)
- Время полного запуска: сборка образа и первый `up` около 4 минут из-за загрузки
  базовых образов; повторный `up` с готовыми образами несколько секунд. Сборка
  выполняется до показа.

## Подготовка за 10 минут до показа

```bash
git status --short                 # пусто
npm ci && npm run quality          # 62 pass, покрытие выше порогов
docker compose build               # длинный шаг заранее
docker compose up -d && docker compose ps
```

Открыть два терминала: в первом команды, во втором `docker compose logs -f api`.
`.env` на экран не выводить, `docker compose config` не запускать.

## План показа

| Время | Действие                                                                                    | Проверяемое свойство   | Ожидаемый результат                                                     |
| ----: | ------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
|  0:00 | `git log -1 --oneline`, `git tag -n1 practice-14-v1.0.0`, схема «клиент → API → PostgreSQL» | релиз однозначен       | тег указывает на релизный коммит, дерево чистое                         |
|  1:00 | `docker compose ps`, `curl -s localhost:5505/health/ready`                                  | воспроизводимый запуск | оба сервиса `healthy`, `{"status":"ready","version":"1.0.0"}`           |
|  2:00 | POST задачи, GET списка с `completed=false`, PATCH `completed: true`, повторный GET         | основной сценарий      | 201 + `Location`, задача в активных, после PATCH пропадает из активных  |
|  4:00 | `PATCH /api/tasks/1 {"completed":"no","id":5}`                                              | валидация без утечек   | 400 `VALIDATION_ERROR`, `details` по полям, нет SQL и стека             |
|  5:00 | `docker compose restart api`, GET созданной задачи                                          | постоянство            | тот же id и значения                                                    |
|  6:00 | `curl -i -H 'X-Request-Id: demo-001' …/api/tasks`, затем строка в журнале                   | наблюдаемость          | заголовок `demo-001` в ответе и в JSON-записи с `status` и `durationMs` |
|  6:40 | `docker compose stop db`, live и ready, `start db`                                          | liveness ≠ readiness   | live 200, ready 503 `not_ready`, после старта снова 200                 |
|  7:00 | `npm run quality`, отчёт о CI                                                               | quality gate           | 0 fail, 0 todo, покрытие выше 85/85/75                                  |
|  8:00 | вариант 1: `X-Request-Id: bad id` и id длиной 65 символов, тест `request-id-variant`        | вариант                | в ответе UUID сервера, входное значение в журнал не попало              |
|  9:00 | ограничения                                                                                 | честная граница релиза | нет TLS, аутентификации, миграций                                       |

## Запасной сценарий

Если не работает Docker или сеть:

- `npm start` на локальной PostgreSQL (`.env` с `DATABASE_URL`) показывает те же
  endpoints и журнал; `kill -TERM <pid>` показывает `shutdown_completed`.
- Сохранённые доказательства без секретов (README, раздел «Автоматические проверки» и
  «Контейнеризация»): `ℹ tests 62 / pass 62 / todo 0`, покрытие строк 97,2 %, ветвей
  93,8 %, функций 96,4 %, вывод `docker compose ps` и smoke.
- Команды повторного запуска: `npm run release:check`, затем
  `docker compose up --build -d && npm run smoke`.
