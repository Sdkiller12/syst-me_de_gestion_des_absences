import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";

export async function audit(
  req: AuthRequest,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: req.user?.schoolId ?? undefined,
        userId: req.user?.id,
        action,
        entity,
        entityId,
        metadata: metadata as never,
        ipAddress: req.ip,
      },
    });
  } catch {
    // Audit must never break the main flow
  }
}
