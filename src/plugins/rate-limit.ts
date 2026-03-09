import fastifyPlugin from "fastify-plugin";

import fastifyRateLimit from "@fastify/rate-limit";

import { env } from "../env";

export const rateLimitPlugin = fastifyPlugin(async (app) => {
  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder(_request, context) {
      return {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded",
          statusCode: 429,
          details: {
            after: context.after
          }
        }
      };
    }
  });
});
