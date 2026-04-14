import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@villageapi.com";
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!user) {
    throw new Error(`Admin user not found: ${adminEmail}`);
  }

  const rawKey = process.env.DEMO_API_KEY || `ak_${crypto.randomBytes(16).toString("hex")}`;
  const rawSecret = process.env.DEMO_API_SECRET || `as_${crypto.randomBytes(16).toString("hex")}`;
  const secretHash = await bcrypt.hash(rawSecret, 10);

  const existing = await prisma.apiKey.findFirst({
    where: { userId: user.id, name: "Demo Public Key" },
    select: { id: true, key: true },
  });

  let saved;
  if (existing) {
    saved = await prisma.apiKey.update({
      where: { id: existing.id },
      data: { key: rawKey, secretHash, status: "ACTIVE", expiresAt: null },
      select: { id: true, key: true, name: true, status: true },
    });
  } else {
    saved = await prisma.apiKey.create({
      data: {
        key: rawKey,
        secretHash,
        name: "Demo Public Key",
        userId: user.id,
        status: "ACTIVE",
      },
      select: { id: true, key: true, name: true, status: true },
    });
  }

  console.log(JSON.stringify({ ...saved, secret: rawSecret }));
}

main()
  .catch((err) => {
    console.error("Failed to create demo API key:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
