import { connection } from "next/server";
import { isCheckStatus, isSymptom, type HealthLog } from "@/lib/health";
import { persistHealthLog } from "@/lib/health-db";
import { isCareKind, type ScheduledTreatment } from "@/lib/medical-schedule";
import { persistScheduledTreatment } from "@/lib/medical-schedule-db";
import { authorize } from "@/lib/session";
import { persistMedicalHistory } from "@/lib/treatment-db";
import { isProtocolId } from "@/lib/treatment-protocols";
import type { MedicalHistoryEntry } from "@/lib/treatment";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const treatment = parseTreatment(body?.treatment);
  if (!treatment) return Response.json({ message: "Jadwal pengobatan tidak valid." }, { status: 400 });
  const log = body && "log" in body && body.log ? parseLog(body.log) : null;
  const entry = body && "entry" in body && body.entry ? parseEntry(body.entry) : null;
  if (body && body.log && !log) return Response.json({ message: "Catatan kesehatan tidak valid." }, { status: 400 });
  if (body && body.entry && !entry) return Response.json({ message: "Riwayat medis tidak valid." }, { status: 400 });
  if (treatment.status === "COMPLETED" && (!log || !entry)) {
    return Response.json({ message: "Penyelesaian jadwal perlu catatan kesehatan dan riwayat medis." }, { status: 400 });
  }
  if (log && log.earTag !== treatment.earTag) return Response.json({ message: "Catatan kesehatan tidak sesuai nomor telinga." }, { status: 400 });
  if (entry && entry.earTag !== treatment.earTag) return Response.json({ message: "Riwayat medis tidak sesuai nomor telinga." }, { status: 400 });

  const today = calendarDate(new Date());
  const saved = await persistScheduledTreatment(treatment, today);
  const health = log ? await persistHealthLog(log) : { stored: false as const };
  const history = entry ? await persistMedicalHistory(entry) : { stored: false as const };
  return Response.json({ ok: true, role: gate.role, stored: saved.stored && (!log || health.stored) && (!entry || history.stored) });
}

function parseTreatment(input: unknown): ScheduledTreatment | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<ScheduledTreatment>;
  if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
  if (typeof row.earTag !== "string" || row.earTag.trim().length < 3) return null;
  if (!isCareKind(row.kind) || typeof row.scheduledOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.scheduledOn)) return null;
  if (typeof row.staffName !== "string" || row.staffName.trim().length < 2) return null;
  if (typeof row.dosage !== "string" || row.dosage.trim().length < 8 || row.dosage.trim().length > 240) return null;
  if (row.status !== "PENDING" && row.status !== "COMPLETED") return null;
  if (row.status === "COMPLETED" && (typeof row.completedAt !== "string" || Number.isNaN(new Date(row.completedAt).getTime()))) return null;
  return {
    id: row.id,
    earTag: row.earTag.trim().toUpperCase(),
    kind: row.kind,
    scheduledOn: row.scheduledOn,
    staffName: row.staffName.trim(),
    dosage: row.dosage.trim(),
    status: row.status,
    completedAt: row.status === "COMPLETED" && typeof row.completedAt === "string" ? row.completedAt : null,
    note: typeof row.note === "string" ? row.note.slice(0, 280) : "",
  };
}

function parseLog(input: unknown): HealthLog | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<HealthLog>;
  if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
  if (typeof row.earTag !== "string" || typeof row.checkedAt !== "string" || Number.isNaN(new Date(row.checkedAt).getTime())) return null;
  if (!isCheckStatus(row.status) || typeof row.temperatureC !== "number" || typeof row.activityLevel !== "number") return null;
  if (typeof row.score !== "number" || typeof row.diagnosticNote !== "string" || typeof row.treatment !== "string") return null;
  const symptoms = Array.isArray(row.symptoms) ? row.symptoms.filter(isSymptom) : [];
  if (Array.isArray(row.symptoms) && symptoms.length !== row.symptoms.length) return null;
  if (row.riskLevel !== "LOW" && row.riskLevel !== "MEDIUM" && row.riskLevel !== "HIGH" && row.riskLevel !== "CRITICAL") return null;
  return {
    id: row.id,
    earTag: row.earTag.trim().toUpperCase(),
    checkedAt: row.checkedAt,
    status: row.status,
    temperatureC: row.temperatureC,
    activityLevel: row.activityLevel,
    symptoms,
    riskLevel: row.riskLevel,
    score: row.score,
    diagnosticNote: row.diagnosticNote,
    treatment: row.treatment,
    manual: true,
  };
}

function parseEntry(input: unknown): MedicalHistoryEntry | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<MedicalHistoryEntry>;
  if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
  if (typeof row.earTag !== "string" || typeof row.protocolId !== "string" || !isProtocolId(row.protocolId)) return null;
  if (typeof row.protocolName !== "string" || typeof row.summary !== "string" || typeof row.isolation !== "string") return null;
  if (typeof row.appliedAt !== "string" || Number.isNaN(new Date(row.appliedAt).getTime())) return null;
  return {
    id: row.id,
    earTag: row.earTag.trim().toUpperCase(),
    healthLogId: typeof row.healthLogId === "string" ? row.healthLogId : "",
    protocolId: row.protocolId,
    protocolName: row.protocolName,
    summary: row.summary,
    isolation: row.isolation,
    appliedAt: row.appliedAt,
  };
}

function calendarDate(now: Date) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
