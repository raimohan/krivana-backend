import { prisma } from "./config/database";
import { connectRedis } from "./config/redis";
import { ensureBaseDirectories } from "./utils/fileSystem";
import { logger } from "./utils/logger";
import { createAiWorker } from "./workers/ai.worker";
import { createBuildWorker } from "./workers/build.worker";
import { createDeployWorker } from "./workers/deploy.worker";

async function startWorker() {
  await ensureBaseDirectories();
  await connectRedis();
  await prisma.$connect();

  const workers = [createAiWorker(), createBuildWorker(), createDeployWorker()];

  workers.forEach((worker) => {
    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, "Worker job completed");
    });
    worker.on("failed", (job, error) => {
      logger.error({ jobId: job?.id, queue: worker.name, error }, "Worker job failed");
    });
  });

  const shutdown = async () => {
    for (const worker of workers) {
      await worker.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("Krivana workers started");
}

startWorker().catch((error) => {
  logger.error(error, "Failed to start workers");
  process.exit(1);
});
