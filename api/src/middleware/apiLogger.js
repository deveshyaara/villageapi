import prisma from "../lib/prisma.js";

/**
 * Persist API usage logs for authenticated API-key requests.
 * Uses fire-and-forget DB writes to avoid adding response latency.
 */
export default function apiLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    if (!req.apiKey?.id || !req.user?.id) return;

    const payload = {
      apiKeyId: req.apiKey.id,
      userId: req.user.id,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime: Date.now() - start,
      ipAddress: req.ip || null,
    };

    prisma.apiLog.create({ data: payload }).catch(() => {});
  });

  next();
}
