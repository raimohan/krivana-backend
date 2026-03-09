import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { deleteMemorySchema, memoryQuerySchema, upsertMemorySchema } from "./memory.schema";
import { deleteMemory, getMemories, upsertMemory } from "./memory.service";

export async function memoryRoutes(app: FastifyInstance) {
  app.get("/memory", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(memoryQuerySchema, request.query);
    return getMemories(request.user.userId, query.projectId);
  });

  app.put("/memory", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(upsertMemorySchema, request.body);
    return upsertMemory(request.user.userId, body);
  });

  app.delete("/memory/:memoryType", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(deleteMemorySchema, request.params);
    const query = parseWithSchema(memoryQuerySchema, request.query);
    return deleteMemory(request.user.userId, params.memoryType, query.projectId);
  });
}
