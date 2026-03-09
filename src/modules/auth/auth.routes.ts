import type { FastifyInstance } from "fastify";

import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";
import { getCurrentUser, loginUser, logoutUser, refreshUserToken, registerUser } from "./auth.service";
import { parseWithSchema } from "../../utils/validation";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (request) => {
    const body = parseWithSchema(registerSchema, request.body);
    return registerUser(body);
  });

  app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (request) => {
    const body = parseWithSchema(loginSchema, request.body);
    return loginUser(body);
  });

  app.post("/auth/refresh", async (request) => {
    const body = parseWithSchema(refreshSchema, request.body);
    return refreshUserToken(body.refreshToken);
  });

  app.post("/auth/logout", { preHandler: [app.authenticate] }, async (request) => {
    return logoutUser(request.user.userId);
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    return getCurrentUser(request.user.userId);
  });
}
