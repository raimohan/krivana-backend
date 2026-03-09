import { MemoryType, type Prisma } from "@prisma/client";

import { prisma } from "../../config/database";

export async function getMemories(userId: string, projectId?: string) {
  const where: Prisma.MemoryWhereInput = projectId
    ? { userId, OR: [{ projectId: null }, { projectId }] }
    : { userId, projectId: null };

  return prisma.memory.findMany({
    where,
    orderBy: [{ projectId: "asc" }, { memoryType: "asc" }]
  });
}

export async function upsertMemory(
  userId: string,
  input: { memoryType: "USER_PROFILE" | "AI_BEHAVIOUR" | "STYLE_PREFERENCES"; content: string | Record<string, unknown>; projectId?: string | null }
) {
  return prisma.memory.upsert({
    where: {
      userId_projectId_memoryType: {
        userId,
        projectId: input.projectId ?? null,
        memoryType: input.memoryType as MemoryType
      }
    },
    update: {
      content: typeof input.content === "string" ? input.content : JSON.stringify(input.content, null, 2)
    },
    create: {
      userId,
      projectId: input.projectId ?? null,
      memoryType: input.memoryType as MemoryType,
      content: typeof input.content === "string" ? input.content : JSON.stringify(input.content, null, 2)
    }
  });
}

export async function deleteMemory(userId: string, memoryType: "USER_PROFILE" | "AI_BEHAVIOUR" | "STYLE_PREFERENCES", projectId?: string) {
  await prisma.memory.deleteMany({
    where: {
      userId,
      projectId: projectId ?? null,
      memoryType: memoryType as MemoryType
    }
  });

  return { success: true };
}
