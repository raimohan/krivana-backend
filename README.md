# Krivana Backend

Self-hostable Fastify + TypeScript backend for the Krivana Flutter app. This backend includes auth, projects, files, chat, AI streaming, GitHub sync, preview containers, deployment jobs, notifications, and a persistent WebSocket layer.

## What is included
- Fastify 4 + TypeScript 5 app scaffold
- Prisma schema for users, projects, chats, memories, notifications, deployments, preview tracking, and integration secrets
- Redis-backed refresh token and queue setup
- SSE AI streaming endpoints with provider adapters for OpenAI, Anthropic, Gemini, Groq, and OpenRouter
- GitHub OAuth, repo import, push, and repo listing routes
- Docker preview and deploy job orchestration scaffolding
- Docker Compose, Nginx, env template, seed script, and worker entrypoint

## Quick Start
1. Copy `.env.example` to `.env`
2. Fill in the required values
3. Use the commands in [STARTUP_COMMANDS.md](./STARTUP_COMMANDS.md)
4. Connect the Flutter app to your backend URL

## Key Endpoints
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /projects`
- `GET /projects/:projectId/files/tree`
- `POST /ai/stream`
- `GET /github/connection`
- `POST /preview/:projectId/start`
- `POST /deploy/:projectId`
- `GET /notifications/unread-count`
- `GET /docs`

## Notes
- Secrets are stored encrypted at rest via AES-256-GCM helper functions.
- Uploads are served from `/uploads`.
- The worker process handles deploy/build queue jobs.
- A `pnpm-lock.yaml` file is not included yet because I did not run dependency installation.

## Recommended next checks
- Run Prisma generate and migrations
- Smoke test `/health`
- Verify GitHub OAuth callback URL in `.env`
- Verify Docker socket access for preview/deploy features
- Add project-specific automated tests once dependencies are installed
