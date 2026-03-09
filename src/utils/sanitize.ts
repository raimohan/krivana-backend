import path from "node:path";

import { AppError } from "./errors";

export function normalizeRelativePath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, "/").trim();
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
}

export function safePath(projectFolderPath: string, relativePath: string) {
  const cleaned = normalizeRelativePath(relativePath);
  const normalizedRoot = path.resolve(projectFolderPath);
  const resolved = path.resolve(normalizedRoot, cleaned);
  const relative = path.relative(normalizedRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("FILE_PATH_TRAVERSAL", 403, "Path traversal attempt detected");
  }

  return resolved;
}
