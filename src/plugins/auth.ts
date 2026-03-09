import fastifyPlugin from "fastify-plugin";

import fastifyJwt from "@fastify/jwt";

import { env } from "../env";
import { authenticate } from "../middleware/authenticate";

export const authPlugin = fastifyPlugin(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET
  });

  app.decorate("authenticate", authenticate);
});
