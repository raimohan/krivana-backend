import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

import { prisma } from "../../config/database";
import { connectRedis, redis } from "../../config/redis";
import { env } from "../../env";
import { conflict, unauthorized } from "../../utils/errors";
import { hashToken } from "../../utils/crypto";

function parseDurationToSeconds(value: string) {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return 60 * 60 * 24 * 30;
  }

  const amount = Number(match[1]);
  switch (match[2]) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      return amount;
  }
}

function signToken(payload: Record<string, unknown>, expiresIn: string) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiresIn as SignOptions["expiresIn"]
  });
}

async function storeRefreshToken(userId: string, refreshToken: string) {
  await connectRedis();
  const hash = hashToken(refreshToken);
  await redis.set(`refresh:${userId}:${hash}`, "1", {
    EX: parseDurationToSeconds(env.JWT_REFRESH_EXPIRY)
  });
}

async function revokeRefreshToken(userId: string, refreshToken: string) {
  await connectRedis();
  const hash = hashToken(refreshToken);
  await redis.del(`refresh:${userId}:${hash}`);
}

async function revokeAllRefreshTokens(userId: string) {
  await connectRedis();
  const keys = await redis.keys(`refresh:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

function buildTokenPair(user: { id: string; email: string }) {
  const accessToken = signToken(
    {
      userId: user.id,
      email: user.email,
      type: "access"
    },
    env.JWT_ACCESS_EXPIRY
  );
  const refreshToken = signToken(
    {
      userId: user.id,
      email: user.email,
      type: "refresh"
    },
    env.JWT_REFRESH_EXPIRY
  );

  return { accessToken, refreshToken };
}

export function serializeUser(user: { id: string; email: string; displayName: string | null; avatarSvgUrl: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarSvgUrl: user.avatarSvgUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function registerUser(input: { email: string; password: string; displayName?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict("AUTH_EMAIL_TAKEN", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      notifications: {
        create: {
          type: "SYSTEM",
          title: "Welcome to Krivana",
          body: "Your self-hosted backend is ready."
        }
      }
    }
  });

  const tokens = buildTokenPair(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: serializeUser(user),
    ...tokens
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw unauthorized("AUTH_INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized("AUTH_INVALID_CREDENTIALS", "Invalid email or password");
  }

  const tokens = buildTokenPair(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: serializeUser(user),
    ...tokens
  };
}

export async function refreshUserToken(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { userId: string; email: string; type: string };
  if (decoded.type !== "refresh") {
    throw unauthorized("AUTH_REFRESH_EXPIRED", "Invalid refresh token");
  }

  await connectRedis();
  const hash = hashToken(refreshToken);
  const exists = await redis.exists(`refresh:${decoded.userId}:${hash}`);
  if (!exists) {
    throw unauthorized("AUTH_REFRESH_EXPIRED", "Refresh token expired");
  }

  await revokeRefreshToken(decoded.userId, refreshToken);
  const tokens = buildTokenPair({ id: decoded.userId, email: decoded.email });
  await storeRefreshToken(decoded.userId, tokens.refreshToken);

  return tokens;
}

export async function logoutUser(userId: string) {
  await revokeAllRefreshTokens(userId);
  return { success: true };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return serializeUser(user);
}
