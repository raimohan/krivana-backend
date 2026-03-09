import fs from "fs-extra";
import path from "node:path";

import { ProjectType, type Prisma } from "@prisma/client";
import simpleGit from "simple-git";

import { prisma } from "../../config/database";
import { env } from "../../env";
import { notFound } from "../../utils/errors";
import { writeProjectFiles } from "../../utils/fileSystem";
import { getPagination } from "../../utils/pagination";
import { getTemplateFiles } from "../../utils/templates";
import { wsHub } from "../../websocket/ws.server";

function projectFolder(userId: string, projectId: string) {
  return path.join(env.PROJECTS_BASE_PATH, userId, projectId);
}

async function buildGitStatus(folderPath: string) {
  const git = simpleGit(folderPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return null;
  }

  const status = await git.status();
  const latest = await git.log({ maxCount: 1 }).catch(() => ({ latest: null as null | { hash: string; message: string } }));

  return {
    ahead: status.ahead,
    behind: status.behind,
    hasChanges: !status.isClean(),
    current: status.current,
    tracking: status.tracking,
    lastCommit: latest.latest
      ? {
          hash: latest.latest.hash,
          message: latest.latest.message
        }
      : null
  };
}

async function ensureOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  });

  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }

  return project;
}

export async function listProjects(
  userId: string,
  input: { page?: number; limit?: number; type?: "ALL" | "CREATED" | "IMPORTED" }
) {
  const { skip, take, page, limit } = getPagination(input.page, input.limit);
  const where: Prisma.ProjectWhereInput = {
    userId,
    ...(input.type && input.type !== "ALL" ? { type: input.type as ProjectType } : {})
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: [{ lastAccessedAt: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.project.count({ where })
  ]);

  return {
    items,
    page,
    limit,
    total
  };
}

export async function createProject(
  userId: string,
  input: { name: string; techStack?: string; description?: string }
) {
  const projectId = crypto.randomUUID();
  const folderPath = projectFolder(userId, projectId);
  await fs.ensureDir(folderPath);
  await writeProjectFiles(folderPath, getTemplateFiles(input.name, input.techStack));

  const project = await prisma.project.create({
    data: {
      id: projectId,
      userId,
      name: input.name,
      description: input.description,
      techStack: input.techStack,
      folderPath,
      type: ProjectType.CREATED,
      lastAccessedAt: new Date()
    }
  });

  await prisma.chat.create({
    data: {
      userId,
      projectId,
      chatType: "PROJECT",
      title: `${input.name} workspace`
    }
  });

  await wsHub.broadcastToUser(userId, {
    type: "PROJECT_CREATED",
    payload: { project }
  });

  return { project };
}

export async function getProject(userId: string, projectId: string) {
  const project = await ensureOwnedProject(userId, projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: { lastAccessedAt: new Date() }
  });

  return {
    ...project,
    gitStatus: project.type === ProjectType.IMPORTED ? await buildGitStatus(project.folderPath) : null
  };
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: { name?: string; techStack?: string; description?: string | null; isPinned?: boolean }
) {
  await ensureOwnedProject(userId, projectId);
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name,
      techStack: input.techStack,
      description: input.description === undefined ? undefined : input.description,
      isPinned: input.isPinned
    }
  });

  await wsHub.broadcastToUser(userId, {
    type: "PROJECT_UPDATED",
    payload: { project }
  });

  return { project };
}

export async function deleteProject(userId: string, projectId: string) {
  const project = await ensureOwnedProject(userId, projectId);
  await fs.remove(project.folderPath);
  await prisma.project.delete({ where: { id: projectId } });

  await wsHub.broadcastToUser(userId, {
    type: "PROJECT_DELETED",
    payload: { projectId }
  });

  return { success: true };
}

export async function listRecentProjects(userId: string, limit = 3) {
  return prisma.project.findMany({
    where: { userId },
    take: limit,
    orderBy: [{ lastAccessedAt: "desc" }, { updatedAt: "desc" }]
  });
}
