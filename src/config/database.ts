import { PrismaClient } from "@prisma/client";

import { env } from "../env";

declare global {
  var __krivanaPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__krivanaPrisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalThis.__krivanaPrisma__ = prisma;
}
