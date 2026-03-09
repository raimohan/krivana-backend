import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { aiStreamSchema, memoryReactionSchema, regenerateSchema } from "./ai.schema";
import { listAvailableModels, regenerateAiResponse, streamAiResponse, updateAiMemoryPreference } from "./ai.service";

export async function aiRoutes(app: FastifyInstance) {
  app.post("/ai/stream", { preHandler: [app.authenticate], config: { rateLimit: { max: 20, timeWindow: 60000 } } }, async (request, reply) => {
    const body = parseWithSchema(aiStreamSchema, request.body);
    await streamAiResponse(request.user.userId, body, reply);
    return reply;
  });

  app.post("/ai/regenerate", { preHandler: [app.authenticate], config: { rateLimit: { max: 20, timeWindow: 60000 } } }, async (request, reply) => {
    const body = parseWithSchema(regenerateSchema, request.body);
    await regenerateAiResponse(request.user.userId, body.messageId, reply);
    return reply;
  });

  app.post("/ai/memory/update", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(memoryReactionSchema, request.body);
    return updateAiMemoryPreference(request.user.userId, body);
  });

  app.get("/ai/models", { preHandler: [app.authenticate] }, async (request) => {
    return listAvailableModels(request.user.userId);
  });
}
