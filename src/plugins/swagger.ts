import fastifyPlugin from "fastify-plugin";

import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

import { env } from "../env";

export const swaggerPlugin = fastifyPlugin(async (app) => {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Krivana Backend API",
        version: env.APP_VERSION
      },
      servers: [
        {
          url: env.API_BASE_URL
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs"
  });
});
