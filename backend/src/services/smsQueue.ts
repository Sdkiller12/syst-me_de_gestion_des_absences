import { prisma } from "../config/database.js";
import { smsService } from "./sms.service.js";
import { logger } from "../config/logger.js";

/**
 * Production-ready SMS dispatch with retry + exponential backoff.
 *
 * Each SmsLog row tracks:
 *   - retryCount   : number of attempts made so far
 *   - maxRetries   : ceiling (default 3, per-row configurable)
 *   - nextRetryAt  : earliest timestamp for the next attempt (backoff)
 *   - status       : PENDING → SENT | FAILED → RETRY_EXHAUSTED
 *
 * Backoff schedule (base 2-minute delay, doubling each retry):
 *   attempt 0 → immediate
 *   attempt 1 → +2 min
 *   attempt 2 → +4 min
 *   attempt 3 → +8 min   (maxRetries=3 → exhausted after this)
 *
 * If REDIS_URL is set, swap this inline worker for a BullMQ worker
 * (see README). This implementation keeps zero-infra deploys working.
 */

const RETRY_BASE_DELAY_MS = 2 * 60 * 1000; // 2 minutes

function nextRetryDelay(retryCount: number): number {
  return RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
}

let draining = false;

async function drainOnce() {
  if (draining) return;
  draining = true;
  try {
    const now = new Date();

    // Pick up to 25 PENDING logs that are either:
    //   - brand new (nextRetryAt is null), or
    //   - past their scheduled retry time
    const pendings = await prisma.smsLog.findMany({
      where: {
        status: "PENDING",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: 25,
    });

    for (const p of pendings) {
      const attemptNumber = p.retryCount; // 0-based: 0 = first try

      try {
        const result = await smsService.sendSms(
          p.recipient || p.phone,
          p.message,
          p.schoolId,
        );

        if (result.success) {
          await prisma.smsLog.update({
            where: { id: p.id },
            data: {
              status: "SENT",
              providerMessageId:
                (result as { providerMessageId?: string }).providerMessageId ?? null,
              errorMessage: null,
              sentAt: new Date(),
              retryCount: attemptNumber + 1,
              nextRetryAt: null,
            },
          });
        } else {
          // Provider returned a non-throwing failure (e.g. invalid number)
          await handleFailedAttempt(p, attemptNumber, (result as { errorMessage?: string }).errorMessage ?? "Échec provider");
        }
      } catch (e) {
        logger.error({ err: e, smsLogId: p.id }, "SMS queue send error");
        await handleFailedAttempt(
          p,
          attemptNumber,
          e instanceof Error ? e.message : "Erreur envoi",
        );
      }
    }
  } finally {
    draining = false;
  }
}

async function handleFailedAttempt(
  p: { id: string; maxRetries: number },
  attemptNumber: number,
  errorMessage: string,
) {
  const nextAttempt = attemptNumber + 1;
  const exhausted = nextAttempt >= p.maxRetries;

  if (exhausted) {
    await prisma.smsLog.update({
      where: { id: p.id },
      data: {
        status: "RETRY_EXHAUSTED",
        errorMessage,
        retryCount: nextAttempt,
        nextRetryAt: null,
        sentAt: new Date(),
      },
    });
    logger.warn({ smsLogId: p.id, attempts: nextAttempt }, "SMS permanently failed after max retries");
  } else {
    const delay = nextRetryDelay(attemptNumber);
    const nextRetryAt = new Date(Date.now() + delay);
    await prisma.smsLog.update({
      where: { id: p.id },
      data: {
        status: "PENDING", // stays PENDING, will be picked up after nextRetryAt
        errorMessage,
        retryCount: nextAttempt,
        nextRetryAt,
      },
    });
    logger.info(
      { smsLogId: p.id, attempt: nextAttempt, nextRetryAt },
      "SMS failed, scheduled for retry",
    );
  }
}

export const smsQueue = {
  /** Fire-and-forget: never throws, never blocks the caller */
  enqueueDrain() {
    setImmediate(() => {
      void drainOnce();
    });
  },

  /** For tests / manual flush */
  async flush() {
    await drainOnce();
  },
};
