import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { wsHub } from "../../websocket/ws.server";
import { projectParamSchema } from "../files/files.schema";
import { getPreviewLogs, getPreviewStatus, restartPreview, startPreview, stopPreview } from "./preview.service";

export async function previewRoutes(app: FastifyInstance) {
  app.post("/preview/:projectId/start", { preHandler: [app.authenticate], config: { rateLimit: { max: 5, timeWindow: 60000 } } }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    return startPreview(request.user.userId, params.projectId);
  });

  app.get("/preview/:projectId/status", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    return getPreviewStatus(request.user.userId, params.projectId);
  });

  app.post("/preview/:projectId/stop", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    return stopPreview(request.user.userId, params.projectId);
  });

  app.post("/preview/:projectId/restart", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    return restartPreview(request.user.userId, params.projectId);
  });

  app.get("/preview/:projectId/logs", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const query = request.query as { tail?: string };
    return getPreviewLogs(request.user.userId, params.projectId, query.tail ? Number(query.tail) : 100);
  });

  app.get("/preview/:projectId/ws", { websocket: true }, async (connection, request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const query = request.query as { token?: string };
    if (!query.token) {
      connection.socket.close(1008, "Missing token");
      return;
    }

    try {
      const decoded = await app.jwt.verify<{ userId: string }>(query.token);
      await getPreviewStatus(decoded.userId, params.projectId);
      wsHub.registerPreviewConnection(params.projectId, connection.socket);
    } catch {
      connection.socket.close(1008, "Unauthorized");
    }
  });
}
