import Dockerode from "dockerode";

import { env } from "../env";

declare global {
  var __krivanaDocker__: Dockerode | undefined;
}

export const docker =
  globalThis.__krivanaDocker__ ??
  new Dockerode({
    socketPath: env.DOCKER_SOCKET
  });

if (env.NODE_ENV !== "production") {
  globalThis.__krivanaDocker__ = docker;
}

export async function checkDocker() {
  try {
    await docker.ping();
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}
