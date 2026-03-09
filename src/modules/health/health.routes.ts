import type { FastifyInstance } from "fastify";

import { prisma } from "../../config/database";
import { checkDocker } from "../../config/docker";
import { connectRedis, redis } from "../../config/redis";
import { env } from "../../env";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const [database, redisStatus, docker] = await Promise.all([
      prisma
        .$queryRaw`SELECT 1`
        .then(() => "ok")
        .catch(() => "error"),
      connectRedis()
        .then(() => redis.ping())
        .then(() => "ok")
        .catch(() => "error"),
      checkDocker()
    ]);

    return {
      status: database === "ok" && redisStatus === "ok" ? "ok" : "error",
      version: env.APP_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis: redisStatus,
        docker
      }
    };
  });
}
