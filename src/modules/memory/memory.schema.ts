import { z } from "zod";

export const memoryQuerySchema = z.object({
  projectId: z.string().optional()
});

export const upsertMemorySchema = z.object({
  memoryType: z.enum(["USER_PROFILE", "AI_BEHAVIOUR", "STYLE_PREFERENCES"]),
  content: z.union([z.string(), z.record(z.any())]),
  projectId: z.string().optional().nullable()
});

export const deleteMemorySchema = z.object({
  memoryType: z.enum(["USER_PROFILE", "AI_BEHAVIOUR", "STYLE_PREFERENCES"])
});
