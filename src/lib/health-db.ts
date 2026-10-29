import { Prisma } from "@prisma/client";
import type { HealthLog } from "@/lib/health";
import { getDb } from "@/lib/social/db";

const HERD_STATUS = {
  HEALTHY: "SEHAT",
  OBSERVATION: "PANTAU",
  QUARANTINE: "KARANTINA",
  SICK: "SAKIT",
} as const;

/** Writes one check when Postgres is available. A missing animal row or table leaves the device book as the record. */
export async function persistHealthLog(log: HealthLog) {
  const db = getDb();
  if (!db) return { stored: false as const };
  const checkedAt = new Date(log.checkedAt);
  if (Number.isNaN(checkedAt.getTime())) return { stored: false as const };
  try {
    await db.animal.updateMany({
      where: { earTag: log.earTag },
      data: { health: HERD_STATUS[log.status], updatedAt: checkedAt },
    });
    await db.livestockHealthLog.create({
      data: {
        id: log.id,
        earTag: log.earTag,
        checkedAt,
        status: log.status,
        temperatureC: log.temperatureC.toFixed(1),
        activityLevel: log.activityLevel,
        symptoms: log.symptoms.join(","),
        riskLevel: log.riskLevel,
        score: log.score,
        diagnosticNote: log.diagnosticNote,
        treatment: log.treatment,
        manual: log.manual,
      },
    });
    return { stored: true as const };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2003" || error.code === "P2021")
    ) {
      return { stored: false as const };
    }
    throw error;
  }
}
