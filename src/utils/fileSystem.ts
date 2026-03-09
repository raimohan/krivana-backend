import fs from "fs-extra";
import path from "node:path";
import { PassThrough } from "node:stream";

import archiver from "archiver";
import mime from "mime-types";

import { env } from "../env";
import { AppError } from "./errors";
import { safePath } from "./sanitize";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  mimeType?: string;
  lastModified?: string;
  children?: FileTreeNode[];
}

export async function ensureBaseDirectories() {
  await fs.ensureDir(env.PROJECTS_BASE_PATH);
  await fs.ensureDir(env.UPLOADS_BASE_PATH);
  await fs.ensureDir(path.join(env.UPLOADS_BASE_PATH, "avatars"));
}

export async function writeProjectFiles(projectRoot: string, files: Record<string, string>) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = safePath(projectRoot, relativePath);
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, content, "utf8");
  }
}

export async function buildFileTree(projectRoot: string, currentPath = ""): Promise<FileTreeNode> {
  const absolutePath = currentPath ? safePath(projectRoot, currentPath) : projectRoot;
  const stats = await fs.stat(absolutePath);
  const relativePath = currentPath ? `/${currentPath.replace(/\\/g, "/")}` : "/";

  if (stats.isFile()) {
    return {
      name: path.basename(absolutePath),
      path: relativePath,
      type: "file",
      size: stats.size,
      mimeType: String(mime.lookup(absolutePath) || "application/octet-stream"),
      lastModified: stats.mtime.toISOString()
    };
  }

  const entries = await fs.readdir(absolutePath);
  const children = await Promise.all(
    entries
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => buildFileTree(projectRoot, currentPath ? path.join(currentPath, entry) : entry))
  );

  return {
    name: currentPath ? path.basename(currentPath) : path.basename(projectRoot),
    path: relativePath,
    type: "directory",
    children
  };
}

export async function readTextFile(projectRoot: string, relativePath: string, maxSizeBytes = 5 * 1024 * 1024) {
  const absolutePath = safePath(projectRoot, relativePath);
  const stats = await fs.stat(absolutePath);

  if (stats.size > maxSizeBytes) {
    throw new AppError("FILE_TOO_LARGE", 413, "File is too large to return inline");
  }

  return fs.readFile(absolutePath, "utf8");
}

export async function ensureProjectWithinSize(projectRoot: string) {
  const size = await directorySize(projectRoot);
  const maxBytes = env.MAX_PROJECT_SIZE_MB * 1024 * 1024;

  if (size > maxBytes) {
    throw new AppError("FILE_TOO_LARGE", 413, "Project storage limit exceeded", {
      size,
      maxBytes
    });
  }
}

export async function directorySize(folderPath: string): Promise<number> {
  const stats = await fs.stat(folderPath);

  if (stats.isFile()) {
    return stats.size;
  }

  const entries = await fs.readdir(folderPath);
  const totals = await Promise.all(entries.map((entry) => directorySize(path.join(folderPath, entry))));

  return totals.reduce((sum, current) => sum + current, 0);
}

export async function createZipStream(projectRoot: string, relativePath: string) {
  const absolutePath = relativePath ? safePath(projectRoot, relativePath) : projectRoot;
  const exists = await fs.pathExists(absolutePath);

  if (!exists) {
    throw new AppError("FILE_NOT_FOUND", 404, "Requested file or folder does not exist");
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  const stats = await fs.stat(absolutePath);
  if (stats.isDirectory()) {
    archive.directory(absolutePath, false);
  } else {
    archive.file(absolutePath, { name: path.basename(absolutePath) });
  }

  void archive.finalize();
  return stream;
}

export async function cloneDirectoryToTemp(sourcePath: string) {
  const tempPath = path.join(sourcePath, "..", `${path.basename(sourcePath)}.backup-${Date.now()}`);
  await fs.copy(sourcePath, tempPath);
  return tempPath;
}

export async function restoreDirectoryFromBackup(targetPath: string, backupPath: string) {
  await fs.remove(targetPath);
  await fs.copy(backupPath, targetPath);
  await fs.remove(backupPath);
}

export async function removeBackup(backupPath: string) {
  await fs.remove(backupPath);
}
