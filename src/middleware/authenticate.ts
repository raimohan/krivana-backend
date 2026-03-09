import type { FastifyReply, FastifyRequest } from "fastify";

import { unauthorized } from "../utils/errors";

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized("AUTH_TOKEN_EXPIRED", "Invalid or expired access token");
  }
}
