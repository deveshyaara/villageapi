import { Router } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { cacheFlushScope } from "../lib/cache.js";

const router = Router();

/**
 * Admin JWT verification guard.
 * Checks the Authorization header for a valid JWT with isAdmin === true.
 */
function adminGuard(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "MISSING_TOKEN", message: "Admin Bearer token required" },
    });
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin access required" },
      });
    }
    req.adminUser = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
    });
  }
}

router.use(adminGuard);

// ─── GET /admin/users ───────────────────────────────────────────

router.get("/users", async (req, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = status ? { status } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          businessName: true,
          gstNumber: true,
          status: true,
          planType: true,
          isAdmin: true,
          createdAt: true,
          _count: { select: { apiKeys: true, apiLogs: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { total, page: Math.max(parseInt(page, 10) || 1, 1), limit: take } },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /admin/users/:id/status ──────────────────────────────

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["PENDING_APPROVAL", "ACTIVE", "SUSPENDED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `status must be one of: ${validStatuses.join(", ")}`,
        },
      });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { status },
      select: { id: true, email: true, businessName: true, status: true },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /admin/users/:id/plan ────────────────────────────────

router.patch("/users/:id/plan", async (req, res, next) => {
  try {
    const { planType } = req.body;
    const validPlans = ["FREE", "PREMIUM", "PRO", "UNLIMITED"];

    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `planType must be one of: ${validPlans.join(", ")}`,
        },
      });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { planType },
      select: { id: true, email: true, businessName: true, planType: true },
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/stats ───────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const [totalUsers, totalVillages, totalApiCalls, usersByStatus, usersByPlan] =
      await Promise.all([
        prisma.user.count(),
        prisma.village.count(),
        prisma.apiLog.count(),
        prisma.user.groupBy({ by: ["status"], _count: true }),
        prisma.user.groupBy({ by: ["planType"], _count: true }),
      ]);

    // Raw Queries for charts
    const topStatesQ = await prisma.$queryRaw`
      SELECT s.name as label, COUNT(v.id)::int as value
      FROM "Village" v
      JOIN "SubDistrict" sd ON v."subDistrictId" = sd.id
      JOIN "District" d ON sd."districtId" = d.id
      JOIN "State" s ON d."stateId" = s.id
      GROUP BY s.name
      ORDER BY value DESC
      LIMIT 10;
    `;

    const apiRequests30DaysQ = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'MM-DD') as label, COUNT(id)::int as value
      FROM "ApiLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt") ASC;
    `;

    const requestsByEndpointQ = await prisma.$queryRaw`
      SELECT endpoint as label, COUNT(id)::int as value
      FROM "ApiLog"
      GROUP BY endpoint
      ORDER BY value DESC
      LIMIT 5;
    `;

    const usageByHourQ = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM "createdAt")::int as label, COUNT(id)::int as value
      FROM "ApiLog"
      WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY label ASC;
    `;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalVillages,
        totalApiCalls,
        usersByStatus,
        usersByPlan,
        topStates: topStatesQ,
        apiRequests30Days: apiRequests30DaysQ,
        requestsByEndpoint: requestsByEndpointQ,
        usageByHour: usageByHourQ
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/cache/flush ────────────────────────────────────

router.post("/cache/flush", async (req, res, next) => {
  try {
    const { scope } = req.body;
    if (scope) {
      await cacheFlushScope(scope);
    } else {
      await Promise.all([
        cacheFlushScope("geo"),
        cacheFlushScope("search"),
        cacheFlushScope("apikey"),
      ]);
    }
    res.json({ success: true, message: scope ? `Cache scope "${scope}" flushed` : "All caches flushed" });
  } catch (err) {
    next(err);
  }
});

export default router;
