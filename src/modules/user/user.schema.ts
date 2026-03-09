import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80)
});
