import { Prisma } from "@prisma/client";
import { isSymptom } from "@/lib/health";
import type { MedicalHistoryEntry, TreatmentCase } from "@/lib/treatment";
import { TREATMENT_PROTOCOLS, type ProtocolSeverity, type TreatmentProtocol } from "@/lib/treatment-protocols";
import { getDb } from "@/lib/social/db";

const STATUS = { terbuka: "TERBUKA", selesai: "SELESAI" } as const;

/** Stores the case when the ear tag already exists in Postgres. Otherwise the herd book remains the record. */
export async function persistTreatmentCase(treatmentCase: TreatmentCase) {
  const db = getDb();
  if (!db) return { stored: false as const };
  const openedAt = new Date(treatmentCase.openedAt);
  const closedAt = treatmentCase.closedAt ? new Date(treatmentCase.closedAt) : null;
  if (Number.isNaN(openedAt.getTime()) || (closedAt && Number.isNaN(closedAt.getTime()))) return { stored: false as const };
  try {
    await db.livestockTreatmentCase.upsert({
      where: { id: treatmentCase.id },
      create: {
        id: treatmentCase.id,
        earTag: treatmentCase.earTag,
        healthLogId: treatmentCase.healthLogId,
        protocolId: treatmentCase.protocolId,
        status: STATUS[treatmentCase.status],
        openedAt,
        closedAt,
        doses: treatmentCase.doses as unknown as Prisma.InputJsonValue,
      },
      update: {
        healthLogId: treatmentCase.healthLogId,
        protocolId: treatmentCase.protocolId,
        status: STATUS[treatmentCase.status],
        closedAt,
        doses: treatmentCase.doses as unknown as Prisma.InputJsonValue,
      },
    });
    return { stored: true as const };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2021")
    ) {
      return { stored: false as const };
    }
    throw error;
  }
}

/** Reads expert protocols from Postgres, filling the table from the catalog when it is empty. */
export async function loadStoredProtocols(): Promise<TreatmentProtocol[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const count = await db.treatmentProtocol.count();
    if (count === 0) {
      await db.treatmentProtocol.createMany({
        data: TREATMENT_PROTOCOLS.map((protocol) => ({
          id: protocol.id,
          name: protocol.name,
          severity: protocol.severity,
          symptoms: protocol.symptoms.join(","),
          routine: protocol.routine,
          summary: protocol.summary,
          isolation: protocol.isolation,
          medicines: protocol.medicines as unknown as Prisma.InputJsonValue,
          steps: protocol.steps,
          verified: true,
        })),
      });
    }
    const rows = await db.treatmentProtocol.findMany();
    const parsed = rows.flatMap(parseProtocolRow);
    return parsed.length > 0 ? parsed : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return null;
    throw error;
  }
}

export async function persistMedicalHistory(entry: MedicalHistoryEntry) {
  const db = getDb();
  if (!db) return { stored: false as const };
  const appliedAt = new Date(entry.appliedAt);
  if (Number.isNaN(appliedAt.getTime())) return { stored: false as const };
  try {
    await db.livestockMedicalHistory.create({
      data: {
        id: entry.id,
        earTag: entry.earTag,
        healthLogId: entry.healthLogId,
        protocolId: entry.protocolId,
        protocolName: entry.protocolName,
        summary: entry.summary,
        isolation: entry.isolation,
        appliedAt,
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

function parseProtocolRow(row: {
  id: string;
  name: string;
  severity: string;
  symptoms: string;
  routine: boolean;
  summary: string;
  isolation: string;
  medicines: Prisma.JsonValue;
  steps: Prisma.JsonValue;
}): TreatmentProtocol[] {
  if (row.severity !== "ringan" && row.severity !== "sedang" && row.severity !== "berat") return [];
  const symptoms = row.symptoms.split(",").map((item) => item.trim()).filter(isSymptom);
  const steps = Array.isArray(row.steps) ? row.steps.filter((item): item is string => typeof item === "string") : [];
  const medicines = parseMedicines(row.medicines);
  if (!medicines) return [];
  const severity: ProtocolSeverity = row.severity;
  return [
    {
      id: row.id,
      name: row.name,
      severity,
      symptoms,
      routine: row.routine,
      summary: row.summary,
      isolation: row.isolation,
      medicines,
      steps,
    },
  ];
}

function parseMedicines(value: Prisma.JsonValue): TreatmentProtocol["medicines"] | null {
  if (!Array.isArray(value)) return null;
  const medicines: TreatmentProtocol["medicines"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as { id?: unknown; name?: unknown; route?: unknown; dosage?: unknown };
    if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.route !== "string") return null;
    if (!row.dosage || typeof row.dosage !== "object" || Array.isArray(row.dosage)) return null;
    const dosage = row.dosage as Record<string, unknown>;
    if (typeof dosage.sapi !== "string" || typeof dosage.kambing !== "string" || typeof dosage.ayam !== "string" || typeof dosage.bebek !== "string") {
      return null;
    }
    medicines.push({
      id: row.id,
      name: row.name,
      route: row.route,
      dosage: { sapi: dosage.sapi, kambing: dosage.kambing, ayam: dosage.ayam, bebek: dosage.bebek },
    });
  }
  return medicines;
}
