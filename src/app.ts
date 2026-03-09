import Fastify from "fastify";

import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import fastifySensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";

import { aiRoutes } from "./modules/ai/ai.routes";
import { apiKeysRoutes } from "./modules/api-keys/apiKeys.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { deployRoutes } from "./modules/deploy/deploy.routes";
import { filesRoutes } from "./modules/files/files.routes";
import { githubRoutes } from "./modules/github/github.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { memoryRoutes } from "./modules/memory/memory.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { previewRoutes } from "./modules/preview/preview.routes";
import { projectsRoutes } from "./modules/projects/projects.routes";
import { userRoutes } from "./modules/user/user.routes";
import { env } from "./env";
import { registerErrorHandler } from "./middleware/errorHandler";
import { authPlugin } from "./plugins/auth";
import { corsPlugin } from "./plugins/cors";
import { rateLimitPlugin } from "./plugins/rate-limit";
import { swaggerPlugin } from "./plugins/swagger";
import { websocketPlugin } from "./plugins/websocket";
import { logger } from "./utils/logger";

export async function buildApp() {
  const app = Fastify({
    logger,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: env.MAX_FILE_SIZE_MB * 1024 * 1024
  });

  registerErrorHandler(app);

  await app.register(fastifySensible);
  await app.register(fastifyHelmet, {
    global: true
  });
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
    }
  });
  await app.register(fastifyStatic, {
    root: env.UPLOADS_BASE_PATH,
    prefix: "/uploads/",
    decorateReply: false
  });

  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);
  await app.register(websocketPlugin);

  await healthRoutes(app);
  await authRoutes(app);
  await userRoutes(app);
  await apiKeysRoutes(app);
  await githubRoutes(app);
  await projectsRoutes(app);
  await filesRoutes(app);
  await chatRoutes(app);
  await aiRoutes(app);
  await memoryRoutes(app);
  await previewRoutes(app);
  await deployRoutes(app);
  await notificationsRoutes(app);

  app.get("/", async () => ({
    name: "Krivana Backend",
    version: env.APP_VERSION,
    docs: `${env.API_BASE_URL}/docs`
  }));

  return app;
}
