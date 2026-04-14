import { Router } from "express";
import prisma from "../lib/prisma.js";
import { cacheGet, cacheSet, TTL } from "../lib/cache.js";
import { deniedStateResponse, getAllowedStateIds } from "../lib/access.js";

const router = Router();

// ─── GET /states ────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const allowedStateIds = await getAllowedStateIds(req.user);
    const cacheSuffix = allowedStateIds ? `:${allowedStateIds.sort((a, b) => a - b).join(",")}` : ":all";
    const cacheKey = `states${cacheSuffix}`;
    const cached = await cacheGet("geo", cacheKey);
    if (cached) {
      return res.sendSuccess(cached, cached.length);
    }

    const states = await prisma.state.findMany({
      where: allowedStateIds ? { id: { in: allowedStateIds } } : undefined,
      include: { country: { select: { name: true, code: true } } },
      orderBy: { name: "asc" },
    });

    await cacheSet("geo", cacheKey, states, TTL.GEOGRAPHY);
    res.sendSuccess(states, states.length);
  } catch (err) {
    next(err);
  }
});

// ─── GET /states/:id/districts ─────────────────────────────

router.get("/:id/districts", async (req, res, next) => {
  try {
    const stateId = parseInt(req.params.id, 10);
    if (isNaN(stateId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "stateId must be a number" },
      });
    }

    const allowedStateIds = await getAllowedStateIds(req.user);
    if (allowedStateIds && !allowedStateIds.includes(stateId)) {
      return deniedStateResponse(res);
    }

    const cacheKey = `districts:${stateId}:${allowedStateIds ? "scoped" : "all"}`;
    const cached = await cacheGet("geo", cacheKey);
    if (cached) {
      return res.sendSuccess(cached, cached.length);
    }

    const districts = await prisma.district.findMany({
      where: { stateId },
      orderBy: { name: "asc" },
    });

    await cacheSet("geo", cacheKey, districts, TTL.GEOGRAPHY);
    res.sendSuccess(districts, districts.length);
  } catch (err) {
    next(err);
  }
});

export default router;
