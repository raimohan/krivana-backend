import fs from "fs-extra";
import path from "node:path";
import { PassThrough } from "node:stream";

import archiver from "archiver";
import axios from "axios";
import { glob } from "glob";
import { DeployProvider, DeployStatus, SecretCategory } from "@prisma/client";

import { deployQueue } from "../../config/queues";
import { prisma } from "../../config/database";
import { docker } from "../../config/docker";
import { decryptSecret, encryptSecret } from "../../utils/crypto";
import { badRequest, notFound } from "../../utils/errors";
import { wsHub } from "../../websocket/ws.server";

async function getProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }
  return project;
}

async function getDeployApiKey(userId: string, provider: string, apiKey?: string, saveKey?: boolean) {
  if (apiKey) {
    if (saveKey) {
      await prisma.integrationSecret.upsert({
        where: {
          userId_category_provider: {
            userId,
            category: SecretCategory.DEPLOYMENT,
            provider
          }
        },
        update: {
          encryptedValue: encryptSecret(apiKey)
        },
        create: {
          userId,
          category: SecretCategory.DEPLOYMENT,
          provider,
          encryptedValue: encryptSecret(apiKey)
        }
      });
    }
    return apiKey;
  }

  const secret = await prisma.integrationSecret.findUnique({
    where: {
      userId_category_provider: {
        userId,
        category: SecretCategory.DEPLOYMENT,
        provider
      }
    }
  });

  if (!secret) {
    throw badRequest("DEPLOY_MISSING_KEY", `Missing saved API key for ${provider}`);
  }

  return decryptSecret(secret.encryptedValue);
}

export async function queueDeployment(
  userId: string,
  projectId: string,
  input: { provider: "vercel" | "netlify" | "github_pages" | "custom"; apiKey?: string; saveKey?: boolean; customWebhookUrl?: string }
) {
  await getProject(userId, projectId);
  const apiKey =
    input.provider === "custom" && !input.apiKey
      ? undefined
      : await getDeployApiKey(userId, input.provider, input.apiKey, input.saveKey);

  const deployment = await prisma.deployment.create({
    data: {
      userId,
      projectId,
      provider: input.provider.toUpperCase() as DeployProvider,
      status: DeployStatus.PENDING,
      providerMeta: input.customWebhookUrl ? { customWebhookUrl: input.customWebhookUrl } : undefined
    }
  });

  await deployQueue.add("deploy", {
    deploymentId: deployment.id,
    userId,
    projectId,
    provider: input.provider,
    apiKey,
    customWebhookUrl: input.customWebhookUrl
  });

  return { deploymentId: deployment.id };
}

export async function listDeploymentHistory(userId: string, projectId: string) {
  await getProject(userId, projectId);
  return prisma.deployment.findMany({
    where: { userId, projectId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDeployment(userId: string, deploymentId: string) {
  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, userId }
  });

  if (!deployment) {
    throw notFound("DEPLOY_FAILED", "Deployment not found");
  }

  return deployment;
}

async function zipProjectToBuffer(folderPath: string) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    archive.on("error", reject);
    archive.pipe(stream);
    archive.directory(folderPath, false);
    void archive.finalize();
  });
}

async function buildVercelFiles(folderPath: string) {
  const files = await glob("**/*", {
    cwd: folderPath,
    nodir: true,
    dot: true
  });

  return Promise.all(
    files.map(async (file) => ({
      file,
      data: await fs.readFile(path.join(folderPath, file), "utf8")
    }))
  );
}

export async function deployToVercel(projectId: string, apiKey: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const response = await axios.post(
    "https://api.vercel.com/v13/deployments",
    {
      name: project.name.toLowerCase().replace(/\s+/g, "-"),
      files: await buildVercelFiles(project.folderPath),
      projectSettings: { framework: project.techStack ?? undefined }
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` }
    }
  );

  return {
    deploymentId: response.data.id,
    url: `https://${response.data.url}`,
    providerMeta: response.data
  };
}

export async function deployToNetlify(projectId: string, apiKey: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const zipBuffer = await zipProjectToBuffer(project.folderPath);

  const siteResponse = await axios.post(
    "https://api.netlify.com/api/v1/sites",
    {},
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const deployResponse = await axios.post(
    `https://api.netlify.com/api/v1/sites/${siteResponse.data.id}/deploys`,
    zipBuffer,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/zip"
      }
    }
  );

  return {
    deploymentId: deployResponse.data.id,
    url: deployResponse.data.ssl_url,
    providerMeta: deployResponse.data
  };
}

export async function deployToGitHubPages(projectId: string, apiKey: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!project.githubRepoName) {
    throw badRequest("DEPLOY_FAILED", "GitHub Pages deploy requires a GitHub-backed project");
  }

  const url = `https://api.github.com/repos/${project.githubRepoName}/pages`;
  const response = await axios.post(
    url,
    {
      source: {
        branch: project.githubBranch ?? "main",
        path: "/"
      }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  return {
    deploymentId: String(response.data.id ?? response.headers["x-github-request-id"] ?? projectId),
    url:
      response.data.html_url ??
      `https://${project.githubRepoName.split("/")[0]}.github.io/${project.githubRepoName.split("/")[1]}/`,
    providerMeta: response.data
  };
}

export async function deployToCustom(projectId: string, customWebhookUrl: string, apiKey?: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const zipBuffer = await zipProjectToBuffer(project.folderPath);
  const response = await axios.post(customWebhookUrl, zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    }
  });

  return {
    deploymentId: String(response.data.id ?? response.headers["x-request-id"] ?? projectId),
    url: response.data.url ?? response.data.deployedUrl ?? customWebhookUrl,
    providerMeta: response.data
  };
}

export async function runBuildContainer(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const container = await docker.createContainer({
    Image: "node:22-alpine",
    Cmd: [
      "sh",
      "-lc",
      "if [ -f package.json ]; then npm install --prefer-offline && npm run build; else echo 'No build step'; fi"
    ],
    WorkingDir: "/app",
    HostConfig: {
      Binds: [`${project.folderPath}:/app`]
    }
  });

  await container.start();
  await container.wait();
  const logs = await container.logs({ stdout: true, stderr: true });
  await container.remove({ force: true }).catch(() => undefined);
  return logs.toString("utf8").split(/\r?\n/).filter(Boolean);
}

export async function processDeploymentJob(job: {
  deploymentId: string;
  userId: string;
  projectId: string;
  provider: "vercel" | "netlify" | "github_pages" | "custom";
  apiKey?: string;
  customWebhookUrl?: string;
}) {
  const buildOutput = await runBuildContainer(job.projectId);
  await prisma.deployment.update({
    where: { id: job.deploymentId },
    data: {
      status: DeployStatus.BUILDING,
      buildLog: buildOutput
    }
  });

  for (const line of buildOutput) {
    wsHub.broadcastDeployment(job.deploymentId, { type: "log", payload: { line } });
  }

  let result: { deploymentId: string; url: string; providerMeta?: unknown };
  switch (job.provider) {
    case "vercel":
      result = await deployToVercel(job.projectId, job.apiKey as string);
      break;
    case "netlify":
      result = await deployToNetlify(job.projectId, job.apiKey as string);
      break;
    case "github_pages":
      result = await deployToGitHubPages(job.projectId, job.apiKey as string);
      break;
    case "custom":
      result = await deployToCustom(job.projectId, job.customWebhookUrl as string, job.apiKey);
      break;
    default:
      throw badRequest("DEPLOY_FAILED", "Unsupported deployment provider");
  }

  await prisma.deployment.update({
    where: { id: job.deploymentId },
    data: {
      status: DeployStatus.SUCCESS,
      deployedUrl: result.url,
      providerMeta: result.providerMeta as never
    }
  });

  wsHub.broadcastDeployment(job.deploymentId, { type: "status", payload: { status: "success" } });
  wsHub.broadcastDeployment(job.deploymentId, { type: "done", payload: { url: result.url } });

  return result;
}
