import fastifyPlugin from "fastify-plugin";

import fastifyWebsocket from "@fastify/websocket";

import { registerGlobalWebsocketRoute } from "../websocket/ws.server";

export const websocketPlugin = fastifyPlugin(async (app) => {
  await app.register(fastifyWebsocket);
  await registerGlobalWebsocketRoute(app);
});
