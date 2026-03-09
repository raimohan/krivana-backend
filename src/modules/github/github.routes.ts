import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { githubImportSchema, githubProjectParamSchema, githubPushSchema, githubRepoParamSchema, githubRepoQuerySchema } from "./github.schema";
import {
  completeGithubOAuth,
  disconnectGithub,
  getGithubConnectionSummary,
  getGithubProjectStatus,
  importGithubRepo,
  listGithubRepos,
  pushGithubProjectChanges,
  startGithubOAuth
} from "./github.service";

export async function githubRoutes(app: FastifyInstance) {
  app.get("/github/oauth/start", { preHandler: [app.authenticate] }, async (request) => {
    return startGithubOAuth(request.user.userId);
  });

  app.get("/github/oauth/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const redirectUrl = await completeGithubOAuth(query.code ?? "", query.state ?? "");
    return reply.redirect(redirectUrl);
  });

  app.get("/github/connection", { preHandler: [app.authenticate] }, async (request) => {
    return getGithubConnectionSummary(request.user.userId);
  });

  app.delete("/github/connection", { preHandler: [app.authenticate] }, async (request) => {
    return disconnectGithub(request.user.userId);
  });

  app.get("/github/repos", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(githubRepoQuerySchema, request.query);
    return listGithubRepos(request.user.userId, query);
  });

  app.post("/github/repos/:owner/:repo/import", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(githubRepoParamSchema, request.params);
    const body = parseWithSchema(githubImportSchema, request.body ?? {});
    return importGithubRepo(request.user.userId, params.owner, params.repo, body.branch);
  });

  app.post("/github/projects/:projectId/push", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(githubProjectParamSchema, request.params);
    const body = parseWithSchema(githubPushSchema, request.body ?? {});
    return pushGithubProjectChanges(request.user.userId, params.projectId, body.message);
  });

  app.get("/github/projects/:projectId/status", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(githubProjectParamSchema, request.params);
    return getGithubProjectStatus(request.user.userId, params.projectId);
  });
}
