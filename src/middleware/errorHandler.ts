import type { FastifyInstance } from "fastify";

import { env } from "../env";
import { asAppError, toErrorPayload } from "../utils/errors";
import { logger } from "../utils/logger";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const appError = asAppError(error);

    logger.error(
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
        error: appError
      },
      appError.message
    );

    const payload = toErrorPayload(error);
    reply.status(appError.statusCode).send(
      env.NODE_ENV === "production"
        ? payload
        : {
            ...payload,
            error: {
              ...payload.error,
              details: {
                ...(payload.error.details as Record<string, unknown>),
                stack: error instanceof Error ? error.stack : undefined
              }
            }
          }
    );
  });
}
