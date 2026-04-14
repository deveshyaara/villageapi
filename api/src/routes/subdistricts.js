import { Router } from "express";
import prisma from "../lib/prisma.js";
import { cacheGet, cacheSet, TTL } from "../lib/cache.js";
import { deniedStateResponse, getAllowedStateIds } from "../lib/access.js";

const router = Router();

// ─── GET /subdistricts/:id/villages ─

router.get("/:id/villages", async (req, res, next) => {
  try {
    const subDistrictId = parseInt(req.params.id, 10);
    if (isNaN(subDistrictId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "subDistrictId must be a number" },
      });
    }

    const { limit = "50", offset = "0" } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 500);
    const skip = parseInt(offset, 10) || 0;

    const subDistrict = await prisma.subDistrict.findUnique({
      where: { id: subDistrictId },
      select: { id: true, district: { select: { stateId: true } } },
    });

    if (!subDistrict) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Sub-district not found" },
      });
    }

    const allowedStateIds = await getAllowedStateIds(req.user);
    if (allowedStateIds && !allowedStateIds.includes(subDistrict.district.stateId)) {
      return deniedStateResponse(res);
    }

    const cacheKey = `villages:${subDistrictId}:${take}:${skip}:${allowedStateIds ? "scoped" : "all"}`;
    const cached = await cacheGet("geo", cacheKey);
    if (cached) {
      return res.sendSuccess(cached.villages, cached.total, { total: cached.total, limit: take, offset: skip });
    }

    const [villages, total] = await Promise.all([
      prisma.village.findMany({
        where: { subDistrictId },
        take,
        skip,
        orderBy: { name: "asc" },
      }),
      prisma.village.count({ where: { subDistrictId } }),
    ]);

    await cacheSet("geo", cacheKey, { villages, total }, TTL.VILLAGE);
    res.sendSuccess(villages, total, { total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
});

export default router;
