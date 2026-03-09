import { Worker } from "bullmq";

import { bullRedis } from "../config/redis";
import { processDeploymentJob } from "../modules/deploy/deploy.service";

export function createDeployWorker() {
  return new Worker(
    "deploy-jobs",
    async (job) => {
      return processDeploymentJob(job.data as {
        deploymentId: string;
        userId: string;
        projectId: string;
        provider: "vercel" | "netlify" | "github_pages" | "custom";
        apiKey?: string;
        customWebhookUrl?: string;
      });
    },
    {
      connection: bullRedis
    }
  );
}
