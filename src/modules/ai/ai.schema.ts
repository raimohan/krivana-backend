import { z } from "zod";

export const aiStreamSchema = z.object({
  chatId: z.string().min(1),
  projectId: z.string().optional(),
  message: z.string().min(1),
  mode: z.enum(["thinking", "fast"]),
  provider: z.string().optional(),
  model: z.string().optional(),
  includeFiles: z.array(z.string()).optional()
});

export const regenerateSchema = z.object({
  messageId: z.string().min(1)
});

export const memoryReactionSchema = z.object({
  reaction: z.enum(["like", "dislike"]),
  messageId: z.string().min(1)
});
