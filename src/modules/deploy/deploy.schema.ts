import { z } from "zod";

export const deployRequestSchema = z.object({
  provider: z.enum(["vercel", "netlify", "github_pages", "custom"]),
  apiKey: z.string().min(1).optional(),
  saveKey: z.boolean().optional(),
  customWebhookUrl: z.string().url().optional()
});

export const deployProjectParamSchema = z.object({
  projectId: z.string().min(1)
});

export const deploymentParamSchema = z.object({
  deploymentId: z.string().min(1)
});
