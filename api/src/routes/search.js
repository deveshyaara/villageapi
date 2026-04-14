import { Router } from "express";
import prisma from "../lib/prisma.js";
import { cacheGet, cacheSet, TTL } from "../lib/cache.js";
import { getAllowedStateIds } from "../lib/access.js";

const router = Router();

function formatVillage(village) {
  const villageName = village.name;
  const subDistrictName = village.subDistrict.name;
  const districtName = village.subDistrict.district.name;
  const stateName = village.subDistrict.district.state.name;
  const countryName = village.subDistrict.district.state.country.name;

  return {
    id: village.id,
    code: village.code,
    name: villageName,
    fullAddress: `${villageName}, ${subDistrictName}, ${districtName}, ${stateName}, ${countryName}`,
    hierarchy: {
      village: villageName,
      subDistrict: subDistrictName,
      district: districtName,
      state: stateName,
      country: countryName,
    },
    subDistrict: subDistrictName,
    district: districtName,
    state: stateName,
    country: countryName,
  };
}

export async function autocompleteHandler(req, res, next) {
  try {
    const { q, limit = "10" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_QUERY", message: "Search query too short or invalid" },
      });
    }

    const take = Math.min(parseInt(limit, 10) || 10, 50);
    const query = q.trim();
    const cacheKey = `autocomplete:${query}:${take}`;

    const cached = await cacheGet("search", cacheKey);
    if (cached) {
      return res.sendSuccess(cached, cached.length);
    }

    const allowedStateIds = await getAllowedStateIds(req.user);
    const villages = await prisma.village.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        ...(allowedStateIds
          ? {
              subDistrict: {
                district: {
                  stateId: { in: allowedStateIds },
                },
              },
            }
          : {}),
      },
      take,
      include: {
        subDistrict: {
          include: {
            district: {
              include: { state: { include: { country: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedData = villages.map((village) => ({
      value: `village_id_${village.id}`,
      label: village.name,
      fullAddress: `${village.name}, ${village.subDistrict.name}, ${village.subDistrict.district.name}, ${village.subDistrict.district.state.name}, ${village.subDistrict.district.state.country.name}`,
      hierarchy: {
        village: village.name,
        subDistrict: village.subDistrict.name,
        district: village.subDistrict.district.name,
        state: village.subDistrict.district.state.name,
        country: village.subDistrict.district.state.country.name,
      },
    }));

    await cacheSet("search", cacheKey, formattedData, TTL.VILLAGE);

    res.sendSuccess(formattedData, formattedData.length);
  } catch (err) {
    next(err);
  }
}

// ─── GET /search?q=<query>&limit=<n>&offset=<n> ────────────────

router.get("/", async (req, res, next) => {
  try {
    const { q, limit = "20", offset = "0" } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message: "Search query too short or invalid",
        },
      });
    }

    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = parseInt(offset, 10) || 0;
    const query = q.trim();
    const cacheKey = `${query}:${take}:${skip}`;

    // Check cache
    const cached = await cacheGet("search", cacheKey);
    if (cached) {
      return res.sendSuccess(cached.formattedData, cached.total, { total: cached.total, limit: cached.take, offset: cached.skip });
    }

    const allowedStateIds = await getAllowedStateIds(req.user);

    // Full-text search with hierarchical includes
    const villages = await prisma.village.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        ...(allowedStateIds
          ? {
              subDistrict: {
                district: {
                  stateId: { in: allowedStateIds },
                },
              },
            }
          : {}),
      },
      take,
      skip,
      include: {
        subDistrict: {
          include: {
            district: {
              include: {
                state: {
                  include: {
                    country: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const total = await prisma.village.count({
      where: {
        name: { contains: query, mode: "insensitive" },
        ...(allowedStateIds
          ? {
              subDistrict: {
                district: {
                  stateId: { in: allowedStateIds },
                },
              },
            }
          : {}),
      },
    });

    const formattedData = villages.map(formatVillage);

    await cacheSet("search", cacheKey, { formattedData, total, take, skip }, TTL.VILLAGE);

    res.sendSuccess(formattedData, total, { total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
});

// ─── GET /autocomplete?q=<query> ────────────────────────────────

router.get("/autocomplete", autocompleteHandler);

export default router;
