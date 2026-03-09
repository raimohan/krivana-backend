import "dotenv/config";

import { bool, cleanEnv, num, port, str } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ["development", "test", "production"], default: "development" }),
  PORT: port({ default: 3000 }),
  HOST: str({ default: "0.0.0.0" }),
  APP_VERSION: str({ default: "1.0.0" }),
  API_BASE_URL: str({ default: "http://localhost:3000" }),
  FRONTEND_URL: str({ default: "krivana://" }),
  ALLOWED_ORIGINS: str({ default: "" }),
  LOG_LEVEL: str({ choices: ["debug", "info", "warn", "error"], default: "info" }),
  ENABLE_CRON_JOBS: bool({ default: true }),

  DATABASE_URL: str(),
  POSTGRES_PASSWORD: str({ default: "change-me" }),

  REDIS_URL: str(),
  REDIS_PASSWORD: str({ default: "change-me" }),

  JWT_SECRET: str(),
  JWT_ACCESS_EXPIRY: str({ default: "15m" }),
  JWT_REFRESH_EXPIRY: str({ default: "30d" }),
  ENCRYPTION_KEY: str(),

  PROJECTS_BASE_PATH: str({ default: "/data/projects" }),
  UPLOADS_BASE_PATH: str({ default: "/data/uploads" }),
  MAX_FILE_SIZE_MB: num({ default: 50 }),
  MAX_PROJECT_SIZE_MB: num({ default: 500 }),

  GITHUB_CLIENT_ID: str({ default: "" }),
  GITHUB_CLIENT_SECRET: str({ default: "" }),
  GITHUB_CALLBACK_URL: str({ default: "" }),
  GITHUB_RELEASES_REPO: str({ default: "" }),

  DOCKER_SOCKET: str({ default: "/var/run/docker.sock" }),
  PREVIEW_PORT_RANGE_START: num({ default: 4000 }),
  PREVIEW_PORT_RANGE_END: num({ default: 5000 }),
  PREVIEW_DOMAIN: str({ default: "" }),
  PREVIEW_PUBLIC_BASE_URL: str({ default: "" }),
  SANDBOX_IMAGE_NODE: str({ default: "node:22-alpine" }),
  SANDBOX_IMAGE_PYTHON: str({ default: "python:3.12-slim" }),
  SANDBOX_CPU_LIMIT: str({ default: "0.5" }),
  SANDBOX_MEMORY_LIMIT: str({ default: "512m" }),

  FIREBASE_PROJECT_ID: str({ default: "" }),
  FIREBASE_CLIENT_EMAIL: str({ default: "" }),
  FIREBASE_PRIVATE_KEY: str({ default: "" }),

  VERCEL_TEAM_ID: str({ default: "" }),
  NETLIFY_SITE_ID: str({ default: "" }),

  RATE_LIMIT_MAX: num({ default: 100 }),
  RATE_LIMIT_WINDOW_MS: num({ default: 60000 })
});
