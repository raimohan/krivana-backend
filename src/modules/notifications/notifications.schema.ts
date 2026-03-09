import { z } from "zod";

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export const notificationIdSchema = z.object({
  id: z.string().min(1)
});

export const deviceTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"])
});
