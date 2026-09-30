# Docker: локальная проверка и подготовка к production

Запускать команды из корня монорепозитория `meal-planner-frontend`. Нужны Docker Engine/Desktop с Docker Compose v2+ и BuildKit. На Mac подходит Docker Desktop либо Docker CLI + Compose + Colima. Бизнес-логика приложения не изменяется.

## Первый запуск

```sh
# Требуется Node.js 22.12+; существующий корневой .env не перезаписывается.
node scripts/init-docker-env.cjs
# Проверка без вывода секретов:
docker compose config --quiet
docker compose up --build
```

Альтернатива генератору: создайте корневой `.env` по `.env.example`, задайте случайные `POSTGRES_PASSWORD` и `JWT_SECRET`. Пустые секреты останавливают Compose ещё до запуска. Для пароля PostgreSQL используйте hex или URL-безопасные символы, поскольку из него составляется `DATABASE_URL`. Существующие `apps/backend/.env` и `apps/frontend/.env` не меняются и не используются контейнерами.

- Приложение: <http://localhost:8080>.
- API и проверка доступности БД: <http://localhost:8081/health>.
- PostgreSQL доступен только внутри Docker по имени `postgres`, порт 5432 на компьютере не открывается.
- Новые аккаунты создаются через обычную регистрацию. Демонстрационные пароли не добавляются.

Для фонового запуска:

```sh
docker compose up --build -d --wait --wait-timeout 180
docker compose ps --all
docker compose logs --tail=100 migrate backend frontend
```

Первый запуск скачивает базовые образы и зависимости. Порты 8080/8081 выбраны так, чтобы не занимать обычные порты разработки 3000/5001.

## Состав и порядок запуска

1. `postgres`: PostgreSQL 16 на Debian, постоянный именованный том `postgres_data`, проверка готовности `pg_isready`.
2. `migrate`: одноразовый контейнер из отдельной стадии backend Dockerfile. После готовности БД выполняет существующие миграции `prisma migrate deploy`, затем существующий seed базового каталога. Нормальное завершение — `Exited (0)`.
3. `backend`: скомпилированный JavaScript, production-зависимости и Prisma Client, созданный для Linux внутри сборки. Стартует после успешной миграции. `/health` проверяет соединение с БД.
4. `frontend`: собранный Nuxt/Nitro `.output`, без исходников и инструментов сборки. Стартует после готовности API.

API и frontend работают от непривилегированного пользователя `node`, с корректной доставкой сигналов остановки через `init`. PostgreSQL и серверы перезапускаются при сбоях. Логи серверов ограничены по размеру. `migrate` при ошибке не пропускает запуск приложения.

Значение `SEED_BASE_CATALOG=true` запускает уже существующее повторяемое обновление базовых продуктов, рецептов и активностей при выполнении `migrate`. Личные рецепты не меняются. Если каталог уже заполнен и обновлять его не нужно, установите `SEED_BASE_CATALOG=false`. Включайте seed для первой пустой базы. Чтобы вручную обновить каталог после миграций:

```sh
docker compose run --rm -e SEED_BASE_CATALOG=true migrate
```

Миграции и seed не выполняются при сборке образа: для `docker compose build` база и production-секреты внутри образа не нужны. Runtime-образ API не содержит компилятор и Prisma CLI; они остаются в стадии `migrate`.

## Настройки перед будущим размещением

По умолчанию опубликованные порты привязаны к `127.0.0.1`. Для сервера нужен HTTPS reverse proxy перед приложением. Фактическое развёртывание рядом с игрой и подключение существующего контейнера Caddy описаны в [server-deployment.md](server-deployment.md).

В корневом `.env`:

- `NUXT_PUBLIC_API_BASE`: публичный адрес API, доступный **браузеру пользователя**, например `https://api.example.com`. Значение `http://backend:5001` здесь неправильно: это внутреннее имя контейнера.
- `CORS_ORIGINS`: точный адрес frontend, например `https://menu.example.com`; несколько адресов разделяются запятой.
- `FRONTEND_PORT`, `BACKEND_PORT`: порты на хосте. При их изменении для локальной работы поправьте также `NUXT_PUBLIC_API_BASE` и `CORS_ORIGINS`.
- `BIND_ADDRESS`: адрес публикации портов. Оставьте `127.0.0.1` для прокси на хосте. `0.0.0.0` открывает порты на всех интерфейсах и требует осознанной настройки доступа.
- `JWT_SECRET`: постоянный случайный секрет токенов; его смена завершит существующие сеансы.
- `POSTGRES_PASSWORD`: постоянный пароль созданной БД. Изменение только `.env` не меняет пароль в уже существующем томе PostgreSQL.

Nuxt принимает `NUXT_PUBLIC_API_BASE` при запуске контейнера, поэтому смена домена не требует изменения исходников или встраивания секретов в клиент. После изменения `.env` используйте `docker compose up -d` для пересоздания контейнеров с новым окружением.

`.dockerignore` исключает локальные `.env`, секреты, резервные копии, host `node_modules`, сборки, Git и временные файлы. В `.env.example` нет готовых паролей. Корневой `.env` исключён из Git.

## Обновление, остановка и данные

Перед обновлением сохраните резервную копию:

```sh
mkdir -p .backups
docker compose exec -T postgres pg_dump -U meal_planner -d meal_planner -Fc > .backups/meal-planner-before-update.dump
# После получения новой версии исходников:
docker compose up --build -d --wait --wait-timeout 180
```

Остановить и убрать контейнеры, сохранив БД:

```sh
docker compose down
```

При следующем `up` данные остаются в именованном томе. **Не добавляйте `--volumes` / `-v` к `down`, если данные нужны.** `migrate reset` и `db push` не используются.

Восстановление копии заменяет данные и должно выполняться осознанно при остановленном API:

```sh
docker compose stop frontend backend
docker compose exec -T postgres pg_restore -U meal_planner -d meal_planner --clean --if-exists --no-owner < .backups/meal-planner-before-update.dump
docker compose up -d --wait
```

Рабочая PostgreSQL на компьютере, прежние меню и файлы окружения разработки остаются отдельными. Покупки, отмеченные в браузере, хранятся в localStorage конкретного адреса сайта: у `localhost:8080` и `localhost:3000` разные браузерные настройки.

## Диагностика

```sh
docker compose ps --all
docker compose logs --tail=150 postgres migrate backend frontend
curl --fail http://localhost:8081/health
curl --fail --output /dev/null http://localhost:8080/
```

`migrate: Exited (0)` — успешное завершение, не сбой. При ошибке миграций исправьте указанную причину и повторите запуск. Не удаляйте том для устранения ошибки на базе с нужными данными.

Официальные справочники: [зависимости и healthcheck в Compose](https://docs.docker.com/compose/how-tos/startup-order/), [Nuxt deployment](https://nuxt.com/docs/3.x/getting-started/deployment), [Colima](https://github.com/abiosoft/colima).

## Локальная среда на этом Mac

При проверке обнаружены нерабочие ссылки от удалённого Docker Desktop. Через Homebrew установлены Docker CLI, Compose, Buildx и Colima. Создан отдельный профиль Colima `meal-planner` (4 CPU, 4 ГБ RAM, диск данных до 30 ГБ); домашняя папка не монтируется в VM, системный Docker-контекст и SSH-конфигурация не переключаются.

Чтобы использовать именно эту среду, из корня проекта в новом терминале:

```sh
export PATH="/opt/homebrew/bin:$PATH"
export DOCKER_CONFIG="$PWD/.docker-local"
export DOCKER_CONTEXT=colima-meal-planner
colima start meal-planner --activate=false --ssh-config=false --mount none
docker compose up --build
```

`.docker-local` содержит только локальную конфигурацию CLI, исключён из Git и образов. Это настройка этого компьютера, не часть серверного развёртывания. На машине с работающим Docker Desktop/Engine эти переменные не нужны. После работы среду можно остановить без удаления базы:

```sh
docker compose down
colima stop meal-planner
```
