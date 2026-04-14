import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { cacheDel } from "../lib/cache.js";

const router = Router();

/**
 * JWT verification guard for B2B portal routes.
 */
function jwtGuard(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "MISSING_TOKEN", message: "Bearer token required" },
    });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    req.jwtUser = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
    });
  }
}

router.use(jwtGuard);

// ─── GET /b2b/api-keys ─────────────────────────────────────────

router.get("/api-keys", async (req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.jwtUser.userId },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
});

// ─── POST /b2b/api-keys ────────────────────────────────────────

router.post("/api-keys", async (req, res, next) => {
  try {
    const { name, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "API key name is required" },
      });
    }

    const keyCount = await prisma.apiKey.count({
      where: { userId: req.jwtUser.userId, status: "ACTIVE" },
    });

    if (keyCount >= 5) {
      return res.status(400).json({
        success: false,
        error: { code: "KEY_LIMIT", message: "Maximum 5 active API keys allowed" },
      });
    }

    const rawKey = `ak_${crypto.randomBytes(16).toString("hex")}`;
    const rawSecret = `as_${crypto.randomBytes(16).toString("hex")}`;
    const secretHash = await bcrypt.hash(rawSecret, 10);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        key: rawKey,
        secretHash,
        name,
        userId: req.jwtUser.userId,
        expiresAt,
      },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the secret only once — it cannot be retrieved again
    res.status(201).json({
      success: true,
      data: { ...apiKey, secret: rawSecret },
      warning: "Store the secret securely — it will not be shown again.",
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /b2b/api-keys/:id ───────────────────────────────────

router.delete("/api-keys/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: req.jwtUser.userId },
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "API key not found" },
      });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    // Invalidate cache for this key
    await cacheDel("apikey", apiKey.key);

    res.json({ success: true, message: "API key revoked" });
  } catch (err) {
    next(err);
  }
});

// ─── GET /b2b/usage ─────────────────────────────────────────────

router.get("/usage", async (req, res, next) => {
  try {
    const { days = "30" } = req.query;
    const since = new Date(Date.now() - parseInt(days, 10) * 86400000);

    const [totalCalls, callsByEndpoint] = await Promise.all([
      prisma.apiLog.count({
        where: { userId: req.jwtUser.userId, createdAt: { gte: since } },
      }),
      prisma.apiLog.groupBy({
        by: ["endpoint"],
        where: { userId: req.jwtUser.userId, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { endpoint: "desc" } },
      }),
    ]);

    const dailyRows = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as "createdAt", COUNT(id)::int as "_count"
      FROM "ApiLog"
      WHERE "userId" = ${req.jwtUser.userId} AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt") ASC;
    `;

    res.json({
      success: true,
      data: { totalCalls, callsByDay: dailyRows, callsByEndpoint, period: { days: parseInt(days, 10), since } },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /b2b/state-access ──────────────────────────────────────

router.get("/state-access", async (req, res, next) => {
  try {
    const access = await prisma.userStateAccess.findMany({
      where: { userId: req.jwtUser.userId },
      include: {
        state: { select: { id: true, code: true, name: true } },
      },
    });

    res.json({ success: true, data: access.map((a) => a.state) });
  } catch (err) {
    next(err);
  }
});

export default router;
