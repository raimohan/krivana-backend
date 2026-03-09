import { z } from "zod";

export const githubRepoQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional()
});

export const githubRepoParamSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1)
});

export const githubProjectParamSchema = z.object({
  projectId: z.string().min(1)
});

export const githubImportSchema = z.object({
  branch: z.string().min(1).optional()
});

export const githubPushSchema = z.object({
  message: z.string().min(1).optional()
});
