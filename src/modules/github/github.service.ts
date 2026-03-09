import fs from "fs-extra";
import path from "node:path";

import axios from "axios";
import { Octokit } from "@octokit/rest";
import { ProjectType } from "@prisma/client";
import simpleGit from "simple-git";

import { prisma } from "../../config/database";
import { connectRedis, redis } from "../../config/redis";
import { env } from "../../env";
import { decryptSecret, encryptSecret } from "../../utils/crypto";
import { badRequest, notFound } from "../../utils/errors";
import { sendNotification } from "../notifications/notifications.service";

async function getConnection(userId: string) {
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId }
  });

  if (!connection) {
    throw badRequest("GITHUB_NOT_CONNECTED", "GitHub account is not connected");
  }

  return connection;
}

function buildOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function startGithubOAuth(userId: string) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_CALLBACK_URL) {
    throw badRequest("GITHUB_OAUTH_DISABLED", "GitHub OAuth is not configured");
  }

  const state = crypto.randomUUID();
  await connectRedis();
  await redis.set(`github:oauth:${state}`, JSON.stringify({ userId }), {
    EX: 600
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GITHUB_CALLBACK_URL);
  url.searchParams.set("scope", "repo read:user user:email");
  url.searchParams.set("state", state);

  return { authUrl: url.toString() };
}

export async function completeGithubOAuth(code: string, state: string) {
  await connectRedis();
  const raw = await redis.get(`github:oauth:${state}`);
  if (!raw) {
    throw badRequest("GITHUB_OAUTH_INVALID_STATE", "OAuth state is invalid or expired");
  }

  const payload = JSON.parse(raw) as { userId: string };
  await redis.del(`github:oauth:${state}`);

  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      state
    },
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  const accessToken = tokenResponse.data.access_token as string;
  const octokit = buildOctokit(accessToken);
  const { data: user } = await octokit.rest.users.getAuthenticated();

  await prisma.gitHubConnection.upsert({
    where: { userId: payload.userId },
    update: {
      githubUserId: String(user.id),
      githubUsername: user.login,
      githubAvatarUrl: user.avatar_url,
      accessToken: encryptSecret(accessToken),
      scopes: tokenResponse.data.scope ? String(tokenResponse.data.scope).split(",") : ["repo", "read:user", "user:email"]
    },
    create: {
      userId: payload.userId,
      githubUserId: String(user.id),
      githubUsername: user.login,
      githubAvatarUrl: user.avatar_url,
      accessToken: encryptSecret(accessToken),
      scopes: tokenResponse.data.scope ? String(tokenResponse.data.scope).split(",") : ["repo", "read:user", "user:email"]
    }
  });

  return `${env.FRONTEND_URL.replace(/\/$/, "")}/github-callback?success=true`;
}

export async function getGithubConnectionSummary(userId: string) {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    return { isConnected: false };
  }

  return {
    isConnected: true,
    username: connection.githubUsername,
    avatarUrl: connection.githubAvatarUrl
  };
}

export async function disconnectGithub(userId: string) {
  await prisma.gitHubConnection.deleteMany({ where: { userId } });
  return { success: true };
}

export async function listGithubRepos(
  userId: string,
  input: { page?: number; per_page?: number; q?: string }
) {
  const connection = await getConnection(userId);
  const octokit = buildOctokit(decryptSecret(connection.accessToken));
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    page: input.page ?? 1,
    per_page: input.per_page ?? 20,
    sort: "updated"
  });

  const filtered = input.q
    ? data.filter((repo) => repo.full_name.toLowerCase().includes(input.q!.toLowerCase()))
    : data;

  return filtered.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    language: repo.language,
    starCount: repo.stargazers_count,
    isPrivate: repo.private,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    cloneUrl: repo.clone_url
  }));
}

export async function importGithubRepo(
  userId: string,
  owner: string,
  repo: string,
  branch = "main"
) {
  const connection = await getConnection(userId);
  const token = decryptSecret(connection.accessToken);
  const projectId = crypto.randomUUID();
  const folderPath = path.join(env.PROJECTS_BASE_PATH, userId, projectId);

  await fs.ensureDir(path.dirname(folderPath));
  const git = simpleGit();
  await git.clone(`https://${token}@github.com/${owner}/${repo}.git`, folderPath, ["--branch", branch, "--depth", "1"]);

  const project = await prisma.project.create({
    data: {
      id: projectId,
      userId,
      name: repo,
      folderPath,
      type: ProjectType.IMPORTED,
      techStack: undefined,
      githubRepoUrl: `https://github.com/${owner}/${repo}`,
      githubRepoName: `${owner}/${repo}`,
      githubBranch: branch,
      lastAccessedAt: new Date()
    }
  });

  await prisma.chat.create({
    data: {
      userId,
      projectId,
      chatType: "PROJECT",
      title: `${repo} workspace`
    }
  });

  return { project };
}

export async function pushGithubProjectChanges(userId: string, projectId: string, message?: string) {
  const connection = await getConnection(userId);
  const token = decryptSecret(connection.accessToken);
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }
  if (project.type !== ProjectType.IMPORTED || !project.githubRepoName) {
    throw badRequest("GITHUB_PUSH_FAILED", "Project is not connected to GitHub");
  }

  const git = simpleGit(project.folderPath);
  await git.addConfig("user.email", "krivana@local.host");
  await git.addConfig("user.name", "Krivana AI");
  await git.remote(["set-url", "origin", `https://${token}@github.com/${project.githubRepoName}.git`]);
  await git.add(".");

  const status = await git.status();
  let commitHash: string | null = null;
  if (!status.isClean()) {
    const commitResult = await git.commit(message ?? "Updated via Krivana");
    commitHash = commitResult.commit;
    await git.push("origin", project.githubBranch ?? "main");
  }

  await sendNotification(userId, {
    type: "GITHUB_PUSH",
    title: "Pushed to GitHub",
    body: `Changes pushed to ${project.githubRepoName}`,
    metadata: { projectId, commitHash }
  });

  return {
    commitHash,
    pushedAt: new Date().toISOString()
  };
}

export async function getGithubProjectStatus(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw notFound("PROJECT_NOT_FOUND", "Project not found");
  }

  const git = simpleGit(project.folderPath);
  const status = await git.status();
  const log = await git.log({ maxCount: 1 }).catch(() => ({ latest: null as null | { hash: string; message: string } }));

  return {
    ahead: status.ahead,
    behind: status.behind,
    hasChanges: !status.isClean(),
    lastCommit: log.latest
      ? {
          hash: log.latest.hash,
          message: log.latest.message
        }
      : null
  };
}
