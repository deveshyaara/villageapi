import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@villageapi.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  const businessName = process.env.ADMIN_BUSINESS_NAME || "VillageAPI Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      businessName,
      status: "ACTIVE",
      planType: "UNLIMITED",
      isAdmin: true,
    },
    create: {
      email,
      passwordHash,
      businessName,
      status: "ACTIVE",
      planType: "UNLIMITED",
      isAdmin: true,
    },
    select: {
      id: true,
      email: true,
      businessName: true,
      status: true,
      planType: true,
      isAdmin: true,
    },
  });

  console.log(JSON.stringify(user));
}

main()
  .catch((err) => {
    console.error("Failed to create admin user:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
