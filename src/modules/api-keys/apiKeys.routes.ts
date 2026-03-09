import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { apiKeyInputSchema, apiKeyUpdateSchema, providerParamSchema } from "./apiKeys.schema";
import { deleteApiKey, listApiKeys, updateApiKey, upsertApiKey } from "./apiKeys.service";

export async function apiKeysRoutes(app: FastifyInstance) {
  app.get("/api-keys", { preHandler: [app.authenticate] }, async (request) => {
    return listApiKeys(request.user.userId);
  });

  app.post("/api-keys", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(apiKeyInputSchema, request.body);
    return upsertApiKey(request.user.userId, body);
  });

  app.patch("/api-keys/:provider", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(providerParamSchema, request.params);
    const body = parseWithSchema(apiKeyUpdateSchema, request.body);
    return updateApiKey(request.user.userId, params.provider, body);
  });

  app.delete("/api-keys/:provider", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(providerParamSchema, request.params);
    return deleteApiKey(request.user.userId, params.provider);
  });
}
