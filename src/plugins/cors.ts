import fastifyPlugin from "fastify-plugin";

import fastifyCors from "@fastify/cors";

import { env } from "../env";

export const corsPlugin = fastifyPlugin(async (app) => {
  const origins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : true;

  await app.register(fastifyCors, {
    origin: origins,
    credentials: true
  });
});
