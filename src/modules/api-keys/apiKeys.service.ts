import { prisma } from "../../config/database";
import { decryptSecret, encryptSecret } from "../../utils/crypto";
import { maskSecret } from "../../utils/mask";

async function clearDefault(userId: string) {
  await prisma.apiKey.updateMany({
    where: { userId },
    data: { isDefault: false }
  });
}

export async function listApiKeys(userId: string) {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { provider: "asc" }]
  });

  return keys.map((item) => ({
    provider: item.provider,
    model: item.model,
    baseUrl: item.baseUrl,
    isDefault: item.isDefault,
    key: maskSecret(decryptSecret(item.keyEncrypted)),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

export async function upsertApiKey(
  userId: string,
  input: { provider: string; key: string; model: string; baseUrl?: string; isDefault?: boolean }
) {
  if (input.isDefault) {
    await clearDefault(userId);
  }

  const key = await prisma.apiKey.upsert({
    where: {
      userId_provider: {
        userId,
        provider: input.provider
      }
    },
    update: {
      keyEncrypted: encryptSecret(input.key),
      model: input.model,
      baseUrl: input.baseUrl,
      isDefault: input.isDefault ?? false
    },
    create: {
      userId,
      provider: input.provider,
      keyEncrypted: encryptSecret(input.key),
      model: input.model,
      baseUrl: input.baseUrl,
      isDefault: input.isDefault ?? false
    }
  });

  return {
    provider: key.provider,
    model: key.model,
    baseUrl: key.baseUrl,
    isDefault: key.isDefault
  };
}

export async function updateApiKey(
  userId: string,
  provider: string,
  input: { key?: string; model?: string; baseUrl?: string | null; isDefault?: boolean }
) {
  if (input.isDefault) {
    await clearDefault(userId);
  }

  const existing = await prisma.apiKey.findUniqueOrThrow({
    where: {
      userId_provider: {
        userId,
        provider
      }
    }
  });

  const updated = await prisma.apiKey.update({
    where: { id: existing.id },
    data: {
      keyEncrypted: input.key ? encryptSecret(input.key) : undefined,
      model: input.model,
      baseUrl: input.baseUrl === null ? null : input.baseUrl,
      isDefault: input.isDefault ?? existing.isDefault
    }
  });

  return {
    provider: updated.provider,
    model: updated.model,
    baseUrl: updated.baseUrl,
    isDefault: updated.isDefault
  };
}

export async function deleteApiKey(userId: string, provider: string) {
  await prisma.apiKey.delete({
    where: {
      userId_provider: {
        userId,
        provider
      }
    }
  });

  return { success: true };
}
