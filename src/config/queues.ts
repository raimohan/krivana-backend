import { Queue } from "bullmq";

import { bullRedis } from "./redis";

export const aiQueue = new Queue("ai-jobs", {
  connection: bullRedis
});

export const buildQueue = new Queue("build-jobs", {
  connection: bullRedis
});

export const deployQueue = new Queue("deploy-jobs", {
  connection: bullRedis
});
