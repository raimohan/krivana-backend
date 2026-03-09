import fs from "fs-extra";
import path from "node:path";

import { prisma } from "../../config/database";
import { env } from "../../env";
import { badRequest } from "../../utils/errors";
import { serializeUser } from "../auth/auth.service";

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return serializeUser(user);
}

export async function updateUserProfile(userId: string, input: { displayName: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: input.displayName
    }
  });

  return serializeUser(user);
}

export async function saveUserAvatar(userId: string, file: { filename: string; mimetype: string; buffer: Buffer }) {
  const isSvg = file.mimetype === "image/svg+xml" || file.filename.toLowerCase().endsWith(".svg");
  if (!isSvg) {
    throw badRequest("FILE_INVALID_TYPE", "Avatar must be an SVG file");
  }

  if (file.buffer.length > 1024 * 1024) {
    throw badRequest("FILE_TOO_LARGE", "Avatar must be smaller than 1MB");
  }

  const avatarDir = path.join(env.UPLOADS_BASE_PATH, "avatars");
  await fs.ensureDir(avatarDir);
  const avatarPath = path.join(avatarDir, `${userId}.svg`);
  await fs.writeFile(avatarPath, file.buffer);

  const avatarSvgUrl = `${env.API_BASE_URL}/uploads/avatars/${userId}.svg`;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarSvgUrl
    }
  });

  return {
    avatarSvgUrl,
    user: serializeUser(user)
  };
}
