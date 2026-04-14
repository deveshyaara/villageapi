import prisma from "./prisma.js";

/**
 * Returns the list of allowed state IDs for a user.
 * If a user has no explicit state mappings, return null to indicate unrestricted access.
 */
export async function getAllowedStateIds(user) {
  if (!user || user.isAdmin) return null;

  const rows = await prisma.userStateAccess.findMany({
    where: { userId: user.id },
    select: { stateId: true },
  });

  if (rows.length === 0) {
    return null;
  }

  return rows.map((r) => r.stateId);
}

export function deniedStateResponse(res) {
  return res.status(403).json({
    success: false,
    error: {
      code: "ACCESS_DENIED",
      message: "User is not authorized to access data for this state",
    },
  });
}
