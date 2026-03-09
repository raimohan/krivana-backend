import { Worker } from "bullmq";

import { bullRedis } from "../config/redis";

export function createAiWorker() {
  return new Worker(
    "ai-jobs",
    async () => {
      return { ok: true };
    },
    {
      connection: bullRedis
    }
  );
}
