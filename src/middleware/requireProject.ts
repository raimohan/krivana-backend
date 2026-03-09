import type { FastifyRequest } from "fastify";

import { prisma } from "../config/database";
import { notFound } from "../utils/errors";

export async function requireProject(request: FastifyRequest) {
  const params = request.params as { projectId?: string; id?: string };
  const projectId = params.projectId ?? params.id;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: request.user.userId
    }
  });

  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }

  request.project = project;
}
