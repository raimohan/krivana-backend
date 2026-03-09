import fs from "fs-extra";
import path from "node:path";

import { prisma } from "../../config/database";
import { wsHub } from "../../websocket/ws.server";
import {
  buildFileTree,
  cloneDirectoryToTemp,
  createZipStream,
  ensureProjectWithinSize,
  readTextFile,
  removeBackup,
  restoreDirectoryFromBackup
} from "../../utils/fileSystem";
import { notFound } from "../../utils/errors";
import { normalizeRelativePath, safePath } from "../../utils/sanitize";

async function getProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  });

  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }

  return project;
}

async function broadcastFileEvent(userId: string, projectId: string, type: string, payload: Record<string, unknown>) {
  await wsHub.broadcastToProject(userId, projectId, {
    type,
    payload: {
      projectId,
      ...payload
    }
  });

  await wsHub.broadcastToUser(userId, {
    type: "PREVIEW_RELOAD",
    payload: { projectId }
  });
}

export async function getFileTree(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  return buildFileTree(project.folderPath);
}

export async function getFileContent(userId: string, projectId: string, filePath: string) {
  const project = await getProject(userId, projectId);
  const content = await readTextFile(project.folderPath, filePath);
  return { content, encoding: "utf8" };
}

export async function createFile(
  userId: string,
  projectId: string,
  input: { path: string; content: string }
) {
  const project = await getProject(userId, projectId);
  const absolutePath = safePath(project.folderPath, input.path);
  await fs.ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, input.content, "utf8");
  await ensureProjectWithinSize(project.folderPath);

  await broadcastFileEvent(userId, projectId, "FILE_CREATED", {
    path: `/${normalizeRelativePath(input.path)}`,
    content: input.content
  });

  return { success: true };
}

export async function updateFile(
  userId: string,
  projectId: string,
  input: { path: string; content: string }
) {
  const project = await getProject(userId, projectId);
  const absolutePath = safePath(project.folderPath, input.path);
  await fs.ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, input.content, "utf8");

  await broadcastFileEvent(userId, projectId, "FILE_UPDATED", {
    path: `/${normalizeRelativePath(input.path)}`,
    content: input.content
  });

  return { success: true };
}

export async function renameEntry(
  userId: string,
  projectId: string,
  input: { oldPath: string; newPath: string }
) {
  const project = await getProject(userId, projectId);
  const sourcePath = safePath(project.folderPath, input.oldPath);
  const destinationPath = safePath(project.folderPath, input.newPath);
  await fs.ensureDir(path.dirname(destinationPath));
  await fs.move(sourcePath, destinationPath, { overwrite: true });

  await broadcastFileEvent(userId, projectId, "FILE_RENAMED", {
    oldPath: `/${normalizeRelativePath(input.oldPath)}`,
    newPath: `/${normalizeRelativePath(input.newPath)}`
  });

  return { success: true };
}

export async function deleteEntry(userId: string, projectId: string, filePath: string) {
  const project = await getProject(userId, projectId);
  const absolutePath = safePath(project.folderPath, filePath);
  const exists = await fs.pathExists(absolutePath);
  if (!exists) {
    throw notFound("FILE_NOT_FOUND", "File not found");
  }

  await fs.remove(absolutePath);
  await broadcastFileEvent(userId, projectId, "FILE_DELETED", {
    path: `/${normalizeRelativePath(filePath)}`
  });

  return { success: true };
}

export async function importFile(
  userId: string,
  projectId: string,
  targetPath: string,
  file: { filename: string; buffer: Buffer }
) {
  const project = await getProject(userId, projectId);
  const destination = safePath(project.folderPath, path.join(targetPath, file.filename));
  await fs.ensureDir(path.dirname(destination));
  await fs.writeFile(destination, file.buffer);
  await ensureProjectWithinSize(project.folderPath);

  await broadcastFileEvent(userId, projectId, "FILE_CREATED", {
    path: `/${normalizeRelativePath(path.join(targetPath, file.filename))}`
  });

  return { success: true };
}

export async function bulkOperate(
  userId: string,
  projectId: string,
  operations: Array<{ op: "create" | "update" | "delete" | "rename" | "move" | "copy"; path: string; newPath?: string; content?: string }>
) {
  const project = await getProject(userId, projectId);
  const backupPath = await cloneDirectoryToTemp(project.folderPath);

  try {
    for (const operation of operations) {
      const sourcePath = safePath(project.folderPath, operation.path);
      const destinationPath = operation.newPath ? safePath(project.folderPath, operation.newPath) : undefined;

      switch (operation.op) {
        case "create":
        case "update":
          await fs.ensureDir(path.dirname(sourcePath));
          await fs.writeFile(sourcePath, operation.content ?? "", "utf8");
          break;
        case "delete":
          await fs.remove(sourcePath);
          break;
        case "rename":
        case "move":
          if (!destinationPath) {
            throw new Error(`Missing newPath for ${operation.op}`);
          }
          await fs.ensureDir(path.dirname(destinationPath));
          await fs.move(sourcePath, destinationPath, { overwrite: true });
          break;
        case "copy":
          if (!destinationPath) {
            throw new Error("Missing newPath for copy");
          }
          await fs.ensureDir(path.dirname(destinationPath));
          await fs.copy(sourcePath, destinationPath, { overwrite: true });
          break;
      }
    }

    await ensureProjectWithinSize(project.folderPath);
    await removeBackup(backupPath);
  } catch (error) {
    await restoreDirectoryFromBackup(project.folderPath, backupPath);
    throw error;
  }

  await wsHub.broadcastToProject(userId, projectId, {
    type: "FILE_UPDATED",
    payload: {
      projectId,
      operations
    }
  });

  return { success: true };
}

export async function downloadPath(userId: string, projectId: string, filePath: string) {
  const project = await getProject(userId, projectId);
  return createZipStream(project.folderPath, filePath);
}
