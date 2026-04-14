import redis from "../lib/redis.js";

const PLAN_LIMITS = {
  FREE: { daily: 5_000, burstPerMinute: 100 },
  PREMIUM: { daily: 50_000, burstPerMinute: 500 },
  PRO: { daily: 300_000, burstPerMinute: 2_000 },
  UNLIMITED: { daily: 1_000_000, burstPerMinute: 5_000 },
};

function startOfNextUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));
}

function startOfNextUtcMinute(date = new Date()) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes() + 1,
    0,
    0
  ));
}

export default async function rateLimiter(req, res, next) {
  try {
    const plan = req.user?.planType || "FREE";
    const userKey = req.user?.id?.toString() || req.ip;
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
    const now = new Date();
    const nextDay = startOfNextUtcDay(now);
    const nextMinute = startOfNextUtcMinute(now);

    const dayBucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
    const minuteBucket = `${dayBucket}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
    const dailyKey = `villageapi:ratelimit:daily:${userKey}:${dayBucket}`;
    const burstKey = `villageapi:ratelimit:minute:${userKey}:${minuteBucket}`;

    const pipeline = redis.multi();
    pipeline.incr(dailyKey);
    pipeline.expireat(dailyKey, Math.floor(nextDay.getTime() / 1000));
    pipeline.incr(burstKey);
    pipeline.expireat(burstKey, Math.floor(nextMinute.getTime() / 1000));

    const results = await pipeline.exec();
    const dailyUsed = Number(results?.[0]?.[1] ?? 0);
    const burstUsed = Number(results?.[2]?.[1] ?? 0);

    const remaining = Math.max(limits.daily - dailyUsed, 0);
    const resetEpoch = Math.floor(nextDay.getTime() / 1000);

    res.setHeader("X-RateLimit-Limit", String(limits.daily));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetEpoch));

    req.rateLimit = {
      limit: limits.daily,
      remaining,
      resetTime: nextDay,
    };

    if (dailyUsed > limits.daily || burstUsed > limits.burstPerMinute) {
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "API quota exceeded for the current plan.",
        },
      });
    }

    next();
  } catch (err) {
    console.error("[RateLimiter] Redis unavailable, allowing request:", err?.message || "unknown error");
    next();
  }
}
