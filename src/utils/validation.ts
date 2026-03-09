import type { ZodType } from "zod";

export function parseWithSchema<T>(schema: ZodType<T>, payload: unknown) {
  return schema.parse(payload);
}
