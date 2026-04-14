import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

async function main() {
  const [stateCount, districtCount, subDistrictCount, villageCount] = await Promise.all([
    prisma.state.count(),
    prisma.district.count(),
    prisma.subDistrict.count(),
    prisma.village.count(),
  ]);

  const redisPing = await redis.ping();

  console.log(
    JSON.stringify({
      db: "ok",
      counts: { stateCount, districtCount, subDistrictCount, villageCount },
      redis: redisPing,
    })
  );
}

main()
  .catch((err) => {
    console.error("Dependency check failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
