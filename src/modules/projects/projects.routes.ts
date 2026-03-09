import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import {
  createProjectSchema,
  projectIdParamSchema,
  projectListQuerySchema,
  recentProjectsSchema,
  updateProjectSchema
} from "./projects.schema";
import { createProject, deleteProject, getProject, listProjects, listRecentProjects, updateProject } from "./projects.service";

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/projects", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(projectListQuerySchema, request.query);
    return listProjects(request.user.userId, query);
  });

  app.post("/projects", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(createProjectSchema, request.body);
    return createProject(request.user.userId, body);
  });

  app.get("/projects/recent", { preHandler: [app.authenticate] }, async (request) => {
    const query = parseWithSchema(recentProjectsSchema, request.query);
    return listRecentProjects(request.user.userId, query.limit ?? 3);
  });

  app.get("/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectIdParamSchema, request.params);
    return getProject(request.user.userId, params.id);
  });

  app.patch("/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectIdParamSchema, request.params);
    const body = parseWithSchema(updateProjectSchema, request.body);
    return updateProject(request.user.userId, params.id, body);
  });

  app.delete("/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectIdParamSchema, request.params);
    return deleteProject(request.user.userId, params.id);
  });
}
