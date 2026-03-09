import type { FastifyInstance } from "fastify";

import { parseWithSchema } from "../../utils/validation";
import { updateProfileSchema } from "./user.schema";
import { getUserProfile, saveUserAvatar, updateUserProfile } from "./user.service";

export async function userRoutes(app: FastifyInstance) {
  app.get("/user/profile", { preHandler: [app.authenticate] }, async (request) => {
    return getUserProfile(request.user.userId);
  });

  app.patch("/user/profile", { preHandler: [app.authenticate] }, async (request) => {
    const body = parseWithSchema(updateProfileSchema, request.body);
    return updateUserProfile(request.user.userId, body);
  });

  app.post("/user/avatar", { preHandler: [app.authenticate] }, async (request) => {
    const uploaded = await request.file();
    if (!uploaded) {
      throw new Error("No avatar file uploaded");
    }

    const buffer = await uploaded.toBuffer();
    return saveUserAvatar(request.user.userId, {
      filename: uploaded.filename,
      mimetype: uploaded.mimetype,
      buffer
    });
  });
}
