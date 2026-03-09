import { Worker } from "bullmq";

import { bullRedis } from "../config/redis";
import { runBuildContainer } from "../modules/deploy/deploy.service";

export function createBuildWorker() {
  return new Worker(
    "build-jobs",
    async (job) => {
      const projectId = job.data.projectId as string;
      return runBuildContainer(projectId);
    },
    {
      connection: bullRedis
    }
  );
}
