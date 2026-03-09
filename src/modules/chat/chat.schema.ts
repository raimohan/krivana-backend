import { z } from "zod";

export const chatListQuerySchema = z.object({
  type: z.enum(["PLANNING", "PROJECT", "COMBINED", "ALL"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const chatIdSchema = z.object({
  chatId: z.string().min(1)
});

export const projectChatParamSchema = z.object({
  projectId: z.string().min(1)
});

export const createChatSchema = z.object({
  projectId: z.string().min(1).optional(),
  chatType: z.enum(["PLANNING", "PROJECT", "COMBINED"]),
  title: z.string().min(1).max(120).optional()
});

export const updateChatSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  isPinned: z.boolean().optional()
});

export const messageListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const createMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});
