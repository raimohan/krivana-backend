import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { wsHub } from "../../websocket/ws.server";
import { deploymentParamSchema, deployProjectParamSchema, deployRequestSchema } from "./deploy.schema";
import { getDeployment, listDeploymentHistory, queueDeployment } from "./deploy.service";

export async function deployRoutes(app: FastifyInstance) {
  app.post("/deploy/:projectId", { preHandler: [app.authenticate], config: { rateLimit: { max: 3, timeWindow: 60000 } } }, async (request) => {
    const params = parseWithSchema(deployProjectParamSchema, request.params);
    const body = parseWithSchema(deployRequestSchema, request.body);
    return queueDeployment(request.user.userId, params.projectId, body);
  });

  app.get("/deploy/:projectId/history", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(deployProjectParamSchema, request.params);
    return listDeploymentHistory(request.user.userId, params.projectId);
  });

  app.get("/deploy/:deploymentId", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(deploymentParamSchema, request.params);
    return getDeployment(request.user.userId, params.deploymentId);
  });

  app.get("/deploy/:deploymentId/ws", { websocket: true }, async (connection, request) => {
    const params = parseWithSchema(deploymentParamSchema, request.params);
    const query = request.query as { token?: string };
    if (!query.token) {
      connection.socket.close(1008, "Missing token");
      return;
    }

    try {
      const decoded = await app.jwt.verify<{ userId: string }>(query.token);
      await getDeployment(decoded.userId, params.deploymentId);
      wsHub.registerDeploymentConnection(params.deploymentId, connection.socket);
    } catch {
      connection.socket.close(1008, "Unauthorized");
    }
  });
}
