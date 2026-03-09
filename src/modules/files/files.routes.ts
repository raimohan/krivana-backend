import path from "node:path";
import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import {
  bulkSchema,
  deleteSchema,
  filePathQuerySchema,
  fileWriteSchema,
  importQuerySchema,
  projectParamSchema,
  renameSchema
} from "./files.schema";
import {
  bulkOperate,
  createFile,
  deleteEntry,
  downloadPath,
  getFileContent,
  getFileTree,
  importFile,
  renameEntry,
  updateFile
} from "./files.service";

export async function filesRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/files/tree", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    return getFileTree(request.user.userId, params.projectId);
  });

  app.get("/projects/:projectId/files/content", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const query = parseWithSchema(filePathQuerySchema, request.query);
    return getFileContent(request.user.userId, params.projectId, query.path);
  });

  app.post("/projects/:projectId/files", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(fileWriteSchema, request.body);
    return createFile(request.user.userId, params.projectId, body);
  });

  app.put("/projects/:projectId/files/content", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(fileWriteSchema, request.body);
    return updateFile(request.user.userId, params.projectId, body);
  });

  app.patch("/projects/:projectId/files/rename", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(renameSchema, request.body);
    return renameEntry(request.user.userId, params.projectId, body);
  });

  app.delete("/projects/:projectId/files", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(deleteSchema, request.body);
    return deleteEntry(request.user.userId, params.projectId, body.path);
  });

  app.post("/projects/:projectId/files/import", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const query = parseWithSchema(importQuerySchema, request.query);
    const uploaded = await request.file();
    if (!uploaded) {
      throw new Error("No file uploaded");
    }

    const buffer = await uploaded.toBuffer();
    return importFile(request.user.userId, params.projectId, query.targetPath, {
      filename: uploaded.filename,
      buffer
    });
  });

  app.post("/projects/:projectId/files/bulk", { preHandler: [app.authenticate] }, async (request) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const body = parseWithSchema(bulkSchema, request.body);
    return bulkOperate(request.user.userId, params.projectId, body.operations);
  });

  app.get("/projects/:projectId/files/download", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = parseWithSchema(projectParamSchema, request.params);
    const query = parseWithSchema(filePathQuerySchema, request.query);
    const stream = await downloadPath(request.user.userId, params.projectId, query.path);

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename=\"${path.basename(query.path || params.projectId)}.zip\"`);
    return reply.send(stream);
  });
}
