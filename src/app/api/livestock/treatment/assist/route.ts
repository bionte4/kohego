import { connection } from "next/server";
import { isCheckStatus, isSpecies, isSymptom, type SymptomCode } from "@/lib/health";
import { authorize } from "@/lib/session";
import { assistTreatment } from "@/lib/treatment-assistant";
import { loadStoredProtocols, persistMedicalHistory } from "@/lib/treatment-db";
import { isProtocolId } from "@/lib/treatment-protocols";
import type { MedicalHistoryEntry } from "@/lib/treatment";

export async function POST(request: Request) {
  await connection();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reading = parseReading(body);
  if (!reading.ok) return Response.json({ message: reading.message }, { status: 400 });
  const entry = body && "entry" in body && body.entry ? parseEntry(body.entry) : null;
  if (body && body.entry && !entry) return Response.json({ message: "Riwayat medis tidak valid." }, { status: 400 });
  const gate = await authorize("livestock", entry ? "update" : "read");
  if (!gate.ok) return gate.response;

  const stored = await loadStoredProtocols();
  const advice = assistTreatment(reading.input, stored ?? undefined);
  const saved = entry ? await persistMedicalHistory(entry) : { stored: false as const };
  return Response.json({
    ok: true,
    role: gate.role,
    source: stored ? "database" : advice.source,
    advice,
    stored: saved.stored,
  });
}

function parseReading(body: Record<string, unknown> | null):
  | {
      ok: true;
      input: {
        species: "sapi" | "kambing" | "ayam" | "bebek";
        status: "HEALTHY" | "OBSERVATION" | "QUARANTINE" | "SICK";
        symptoms: SymptomCode[];
        temperatureC: number | null;
        activityLevel: number | null;
      };
    }
  | { ok: false; message: string } {
  if (!body || !isSpecies(body.species) || !isCheckStatus(body.status)) {
    return { ok: false, message: "Pemeriksaan untuk asisten tidak valid." };
  }
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms.filter(isSymptom) : [];
  if (Array.isArray(body.symptoms) && symptoms.length !== body.symptoms.length) {
    return { ok: false, message: "Gejala tidak dikenal." };
  }
  const temperatureC = body.temperatureC === null || body.temperatureC === undefined ? null : Number(body.temperatureC);
  const activityLevel = body.activityLevel === null || body.activityLevel === undefined ? null : Number(body.activityLevel);
  if (temperatureC !== null && (!Number.isFinite(temperatureC) || temperatureC < 34 || temperatureC > 45)) {
    return { ok: false, message: "Suhu harus antara 34 dan 45°C." };
  }
  if (activityLevel !== null && (!Number.isInteger(activityLevel) || activityLevel < 0 || activityLevel > 100)) {
    return { ok: false, message: "Aktivitas harus bilangan 0–100." };
  }
  return { ok: true, input: { species: body.species, status: body.status, symptoms, temperatureC, activityLevel } };
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
