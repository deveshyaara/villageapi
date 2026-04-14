import { Router } from "express";
import prisma from "../lib/prisma.js";
import { cacheGet, cacheSet, TTL } from "../lib/cache.js";
import { deniedStateResponse, getAllowedStateIds } from "../lib/access.js";

const router = Router();

// ─── GET /districts/:id/subdistricts ───

router.get("/:id/subdistricts", async (req, res, next) => {
  try {
    const districtId = parseInt(req.params.id, 10);
    if (isNaN(districtId)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "districtId must be a number" },
      });
    }

    const district = await prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true, stateId: true },
    });

    if (!district) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "District not found" },
      });
    }

    const allowedStateIds = await getAllowedStateIds(req.user);
    if (allowedStateIds && !allowedStateIds.includes(district.stateId)) {
      return deniedStateResponse(res);
    }

    const cacheKey = `subdistricts:${districtId}:${allowedStateIds ? "scoped" : "all"}`;
    const cached = await cacheGet("geo", cacheKey);
    if (cached) {
      return res.sendSuccess(cached, cached.length);
    }

    const subDistricts = await prisma.subDistrict.findMany({
      where: { districtId },
      orderBy: { name: "asc" },
    });

    await cacheSet("geo", cacheKey, subDistricts, TTL.GEOGRAPHY);
    res.sendSuccess(subDistricts, subDistricts.length);
  } catch (err) {
    next(err);
  }
});

export default router;
