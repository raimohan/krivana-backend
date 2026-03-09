# Startup Commands

These commands are provided for the next manual step. They were not run by me.

## Copy env file
- Linux/macOS: `cp .env.example .env`
- Windows PowerShell: `Copy-Item .env.example .env`

## Docker-first startup
1. Fill in `.env` with at least:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
2. Start the stack:
   `docker compose up -d --build`
3. Run Prisma generate:
   `docker compose exec api pnpm db:generate`
4. Run migrations:
   `docker compose exec api pnpm db:deploy`
5. Optional seed:
   `docker compose exec api pnpm db:seed`

## Local dev startup
1. Install dependencies:
   `pnpm install`
2. Generate Prisma client:
   `pnpm db:generate`
3. Start infra:
   `docker compose -f docker-compose.dev.yml up -d postgres redis`
4. Run API:
   `pnpm dev`
5. Run worker:
   `pnpm dev:worker`

## Health check
- API health: `GET /health`
- Docs: `/docs`
- Global WebSocket: `/ws?token=<accessToken>`
