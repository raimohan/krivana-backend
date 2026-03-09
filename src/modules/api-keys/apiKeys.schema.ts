import { z } from "zod";

export const apiKeyInputSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
  isDefault: z.boolean().optional()
});

export const apiKeyUpdateSchema = z.object({
  key: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().nullable(),
  isDefault: z.boolean().optional()
});

export const providerParamSchema = z.object({
  provider: z.string().min(1)
});
