import { Prisma } from "@prisma/client";
import type { ScheduledTreatment } from "@/lib/medical-schedule";
import { getDb } from "@/lib/social/db";

/** Stores the visit when the ear tag already exists in Postgres. Otherwise the herd book remains the record. */
export async function persistScheduledTreatment(treatment: ScheduledTreatment, today: string) {
  const db = getDb();
  if (!db) return { stored: false as const };
  const scheduledOn = new Date(`${treatment.scheduledOn}T00:00:00.000Z`);
  const completedAt = treatment.completedAt ? new Date(treatment.completedAt) : null;
  if (Number.isNaN(scheduledOn.getTime()) || (completedAt && Number.isNaN(completedAt.getTime()))) {
    return { stored: false as const };
  }
  const status = treatment.status === "COMPLETED" ? "COMPLETED" : treatment.scheduledOn < today ? "OVERDUE" : "PENDING";
  try {
    await db.livestockTreatment.upsert({
      where: { id: treatment.id },
      create: {
        id: treatment.id,
        earTag: treatment.earTag,
        kind: treatment.kind,
        scheduledOn,
        staffName: treatment.staffName,
        dosage: treatment.dosage,
        status,
        completedAt,
        note: treatment.note,
      },
      update: {
        kind: treatment.kind,
        scheduledOn,
        staffName: treatment.staffName,
        dosage: treatment.dosage,
        status,
        completedAt,
        note: treatment.note,
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
