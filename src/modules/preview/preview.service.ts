import fs from "fs-extra";

import { docker } from "../../config/docker";
import { prisma } from "../../config/database";
import { env } from "../../env";
import { notFound } from "../../utils/errors";
import { wsHub } from "../../websocket/ws.server";

function parseMemoryLimit(value: string) {
  const match = /^(\d+)([kmg])$/i.exec(value.trim());
  if (!match) {
    return 512 * 1024 * 1024;
  }

  const amount = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case "k":
      return amount * 1024;
    case "m":
      return amount * 1024 * 1024;
    case "g":
      return amount * 1024 * 1024 * 1024;
    default:
      return amount;
  }
}

async function getProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }
  return project;
}

async function allocatePort() {
  const previews = await prisma.previewProcess.findMany({ select: { port: true } });
  const used = new Set(previews.map((preview) => preview.port));

  for (let port = env.PREVIEW_PORT_RANGE_START; port <= env.PREVIEW_PORT_RANGE_END; port += 1) {
    if (!used.has(port)) {
      return port;
    }
  }

  throw new Error("No preview ports available");
}

async function detectProjectType(folderPath: string) {
  const hasPackageJson = await fs.pathExists(`${folderPath}/package.json`);
  const hasIndexHtml = await fs.pathExists(`${folderPath}/index.html`);

  if (!hasPackageJson && hasIndexHtml) {
    return "static";
  }

  if (!hasPackageJson) {
    return "node";
  }

  const packageJson = JSON.parse(await fs.readFile(`${folderPath}/package.json`, "utf8"));
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };

  if (deps.next) {
    return "nextjs";
  }

  if (deps.vite && deps.react) {
    return "vite-react";
  }

  return "node";
}

function buildPreviewCommand(projectType: string) {
  switch (projectType) {
    case "nextjs":
      return "npm install --prefer-offline && npm run dev -- --hostname 0.0.0.0 --port 3000";
    case "vite-react":
      return "npm install --prefer-offline && npm run dev -- --host 0.0.0.0 --port 3000";
    case "static":
      return "python -m http.server 3000 --directory /app";
    default:
      return "npm install --prefer-offline && npm run dev -- --host 0.0.0.0 --port 3000 || node index.js";
  }
}

function buildPreviewUrl(projectId: string, port: number) {
  if (env.PREVIEW_PUBLIC_BASE_URL) {
    return `${env.PREVIEW_PUBLIC_BASE_URL.replace(/\/$/, "")}/${projectId}`;
  }

  if (env.PREVIEW_DOMAIN) {
    return `https://${projectId}.${env.PREVIEW_DOMAIN}`;
  }

  return `http://localhost:${port}`;
}

export async function startPreview(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  const existing = await prisma.previewProcess.findUnique({ where: { projectId } });
  if (existing?.containerId && existing.status === "running") {
    return {
      previewUrl: existing.previewUrl,
      status: existing.status,
      port: existing.port,
      containerId: existing.containerId
    };
  }

  const port = existing?.port ?? (await allocatePort());
  const projectType = await detectProjectType(project.folderPath);
  const image = projectType === "static" ? env.SANDBOX_IMAGE_PYTHON : env.SANDBOX_IMAGE_NODE;
  const command = buildPreviewCommand(projectType);

  if (existing?.containerId) {
    const oldContainer = docker.getContainer(existing.containerId);
    await oldContainer.remove({ force: true }).catch(() => undefined);
  }

  const container = await docker.createContainer({
    Image: image,
    name: `krivana-preview-${projectId}`,
    WorkingDir: "/app",
    Cmd: ["sh", "-lc", command],
    ExposedPorts: { "3000/tcp": {} },
    HostConfig: {
      Binds: [`${project.folderPath}:/app`],
      PortBindings: { "3000/tcp": [{ HostPort: String(port) }] },
      Memory: parseMemoryLimit(env.SANDBOX_MEMORY_LIMIT),
      NanoCPUs: Math.floor(Number(env.SANDBOX_CPU_LIMIT) * 1000000000)
    }
  });

  await container.start();

  const preview = await prisma.previewProcess.upsert({
    where: { projectId },
    update: {
      containerId: container.id,
      port,
      status: "running",
      previewUrl: buildPreviewUrl(projectId, port),
      startedAt: new Date()
    },
    create: {
      projectId,
      containerId: container.id,
      port,
      status: "running",
      previewUrl: buildPreviewUrl(projectId, port),
      startedAt: new Date()
    }
  });

  wsHub.broadcastPreview(projectId, {
    type: "ready",
    payload: { url: preview.previewUrl }
  });
  await wsHub.broadcastToUser(userId, {
    type: "PREVIEW_READY",
    payload: { projectId, url: preview.previewUrl }
  });

  return {
    previewUrl: preview.previewUrl,
    status: preview.status,
    port: preview.port,
    containerId: preview.containerId
  };
}

export async function getPreviewStatus(userId: string, projectId: string) {
  await getProject(userId, projectId);
  const preview = await prisma.previewProcess.findUnique({ where: { projectId } });
  if (!preview) {
    return { status: "stopped", previewUrl: null, port: null, containerId: null };
  }

  return {
    status: preview.status,
    previewUrl: preview.previewUrl,
    port: preview.port,
    containerId: preview.containerId
  };
}

export async function stopPreview(userId: string, projectId: string) {
  await getProject(userId, projectId);
  const preview = await prisma.previewProcess.findUnique({ where: { projectId } });
  if (!preview?.containerId) {
    return { success: true };
  }

  const container = docker.getContainer(preview.containerId);
  await container.remove({ force: true }).catch(() => undefined);
  await prisma.previewProcess.update({
    where: { projectId },
    data: {
      status: "stopped",
      containerId: null,
      previewUrl: null
    }
  });

  return { success: true };
}

export async function restartPreview(userId: string, projectId: string) {
  await stopPreview(userId, projectId);
  return startPreview(userId, projectId);
}

export async function getPreviewLogs(userId: string, projectId: string, tail = 100) {
  await getProject(userId, projectId);
  const preview = await prisma.previewProcess.findUnique({ where: { projectId } });
  if (!preview?.containerId) {
    return [];
  }

  const container = docker.getContainer(preview.containerId);
  const logs = await container.logs({ stdout: true, stderr: true, tail });
  return logs.toString("utf8").split(/\r?\n/).filter(Boolean);
}
