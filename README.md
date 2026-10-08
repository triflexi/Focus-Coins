# Focus Coins

Таймер концентрации, виртуальные монеты, три игры и месячный рейтинг.  React/Vite, React Native/Expo, NestJS, PostgreSQL/Prisma.

## Локальный запуск

Нужны Node.js 22.12 или новее, npm 11 и Docker Desktop с Linux-контейнерами. Из корня репозитория:

Выберите один режим запуска. Перед переходом из dev в контейнеры завершите `npm run dev` через Ctrl+C. Перед переходом обратно остановите контейнерные API/web: `docker compose stop api web`. В `.env` задайте `WEB_ORIGIN=http://localhost:5173` для dev или `http://localhost:8080` для контейнерного сайта.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run build -w @focus/core
npm run dev
```

Откройте http://localhost:5173 и зарегистрируйте аккаунт.

Запуск в контейнерах:

```powershell
docker compose up --build -d
```

Сайт будет доступен на http://localhost:8080.