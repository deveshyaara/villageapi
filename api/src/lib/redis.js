import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Redis from "ioredis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../.env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const RECONNECT_MAX_RETRIES = 10;
const RECONNECT_BASE_DELAY_MS = 500;

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > RECONNECT_MAX_RETRIES) {
      console.error(
        `[Redis] Exceeded ${RECONNECT_MAX_RETRIES} reconnection attempts — giving up`
      );
      return null; // stop retrying
    }
    const delay = Math.min(times * RECONNECT_BASE_DELAY_MS, 5000);
    console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("ready", () => {
  console.log("[Redis] Ready to accept commands");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err?.message || err?.code || "Unknown error");
});

redis.on("close", () => {
  console.warn("[Redis] Connection closed");
});

export default redis;
