import { prisma } from "./config/database";
import { connectRedis } from "./config/redis";
import { buildApp } from "./app";
import { env } from "./env";
import { ensureBaseDirectories } from "./utils/fileSystem";
import { logger } from "./utils/logger";

async function start() {
  await ensureBaseDirectories();
  await connectRedis();
  await prisma.$connect();

  const app = await buildApp();

  const onShutdown = async () => {
    logger.info("Shutting down Krivana backend");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", onShutdown);
  process.on("SIGTERM", onShutdown);

  await app.listen({
    host: env.HOST,
    port: env.PORT
  });

  logger.info(`Krivana backend listening on ${env.HOST}:${env.PORT}`);
}

start().catch((error) => {
  logger.error(error, "Failed to start Krivana backend");
  process.exit(1);
});
