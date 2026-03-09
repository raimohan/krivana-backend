import { z } from "zod";

export const projectParamSchema = z.object({
  projectId: z.string().min(1)
});

export const filePathQuerySchema = z.object({
  path: z.string().default("")
});

export const fileWriteSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.string().default("utf8")
});

export const renameSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1)
});

export const deleteSchema = z.object({
  path: z.string().min(1)
});

export const bulkOperationSchema = z.object({
  op: z.enum(["create", "update", "delete", "rename", "move", "copy"]),
  path: z.string().min(1),
  newPath: z.string().optional(),
  content: z.string().optional()
});

export const bulkSchema = z.object({
  operations: z.array(bulkOperationSchema).min(1)
});

export const importQuerySchema = z.object({
  targetPath: z.string().default("")
});
