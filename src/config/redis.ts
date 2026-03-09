import IORedis from "ioredis";
import { createClient } from "redis";

import { env } from "../env";

declare global {
  var __krivanaRedis__: ReturnType<typeof createClient> | undefined;
  var __krivanaBullRedis__: IORedis | undefined;
}

export const redis =
  globalThis.__krivanaRedis__ ??
  createClient({
    url: env.REDIS_URL
  });

export const bullRedis =
  globalThis.__krivanaBullRedis__ ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

if (env.NODE_ENV !== "production") {
  globalThis.__krivanaRedis__ = redis;
  globalThis.__krivanaBullRedis__ = bullRedis;
}

let isRedisReady = false;

export async function connectRedis() {
  if (!isRedisReady) {
    await redis.connect();
    isRedisReady = true;
  }
}
