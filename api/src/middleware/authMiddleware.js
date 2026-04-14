import prisma from "../lib/prisma.js";
import { cacheGet, cacheSet, TTL } from "../lib/cache.js";

/**
 * Authenticate requests via the `x-api-key` header.
 *
 * Flow:
 *  1. Extract the API key from the header.
 *  2. Check Redis cache for a cached key record.
 *  3. On cache miss, look up the key in PostgreSQL via Prisma.
 *  4. Validate key status, user status, and expiry.
 *  5. Attach `req.apiKey` and `req.user` for downstream handlers.
 */
export default async function authMiddleware(req, res, next) {
  const headerKey = req.headers["x-api-key"];

  if (!headerKey) {
    return res.status(401).json({
      success: false,
      error: { code: "MISSING_API_KEY", message: "x-api-key header is required" },
    });
  }

  const isWriteOperation = req.method !== "GET";
  const headerSecret = req.headers["x-api-secret"];

  if (isWriteOperation && !headerSecret) {
    return res.status(401).json({
      success: false,
      error: { code: "MISSING_API_SECRET", message: "x-api-secret header is required for write operations" },
    });
  }

  try {
    // 1. Try Redis cache first
    let record = await cacheGet("apikey", headerKey);

    // 2. Cache miss → query database
    if (!record) {
      const apiKey = await prisma.apiKey.findUnique({
        where: { key: headerKey },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              businessName: true,
              status: true,
              planType: true,
              isAdmin: true,
            },
          },
        },
      });

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "The provided API key is not valid" },
        });
      }

      record = {
        id: apiKey.id,
        key: apiKey.key,
        secretHash: apiKey.secretHash,
        status: apiKey.status,
        expiresAt: apiKey.expiresAt,
        userId: apiKey.userId,
        user: apiKey.user,
      };

      // Warm the cache
      await cacheSet("apikey", headerKey, record, TTL.API_KEY);
    }

    if (isWriteOperation) {
      // bcrypt is required, need to import it at the top
      const bcrypt = await import("bcrypt");
      const isValidSecret = await bcrypt.compare(headerSecret, record.secretHash);
      if (!isValidSecret) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_SECRET", message: "The provided API secret is not valid" },
        });
      }
    }

    // 3. Validate key status
    if (record.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: { code: "KEY_REVOKED", message: "This API key has been revoked" },
      });
    }

    // 4. Check expiry
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return res.status(403).json({
        success: false,
        error: { code: "KEY_EXPIRED", message: "This API key has expired" },
      });
    }

    // 5. Validate user status
    if (record.user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "ACCOUNT_INACTIVE",
          message: `Account is ${record.user.status.toLowerCase().replace("_", " ")}`,
        },
      });
    }

    // 6. Attach to request
    req.apiKey = record;
    req.user = record.user;

    // 7. Fire-and-forget: update lastUsedAt
    prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}
