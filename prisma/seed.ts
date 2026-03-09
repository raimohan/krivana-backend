import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? "demo@krivana.local";
  const password = process.env.SEED_USER_PASSWORD ?? "change-me-please";
  const displayName = process.env.SEED_USER_NAME ?? "Krivana Demo";

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { displayName, passwordHash },
    create: {
      email,
      displayName,
      passwordHash,
      notifications: {
        create: {
          type: "SYSTEM",
          title: "Welcome to Krivana",
          body: "Your backend seed user is ready."
        }
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
