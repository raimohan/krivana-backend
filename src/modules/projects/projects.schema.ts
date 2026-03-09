import { z } from "zod";

export const projectListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.enum(["ALL", "CREATED", "IMPORTED"]).optional()
});

export const projectIdParamSchema = z.object({
  id: z.string().min(1)
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  techStack: z.string().max(80).optional(),
  description: z.string().max(500).optional()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  techStack: z.string().max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  isPinned: z.boolean().optional()
});

export const recentProjectsSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional()
});
