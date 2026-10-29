import { connection } from "next/server";
import { persistHealthLog } from "@/lib/health-db";
import {
  assessHealth,
  isCheckStatus,
  isSpecies,
  isSymptom,
  manualAssessment,
  type HealthLog,
  type SymptomCode,
} from "@/lib/health";
import { authorize } from "@/lib/session";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseCheck(body);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });

  const assessment = parsed.manual ? manualAssessment(parsed.status) : assessHealth(parsed.reading);
  const log: HealthLog = {
    id: parsed.id,
    earTag: parsed.earTag,
    checkedAt: parsed.checkedAt,
    temperatureC: parsed.reading.temperatureC,
    activityLevel: parsed.reading.activityLevel,
    symptoms: parsed.reading.symptoms,
    manual: parsed.manual,
    ...assessment,
  };
  const saved = await persistHealthLog(log);
  return Response.json({ ok: true, role: gate.role, stored: saved.stored, log });
}

function parseCheck(body: Record<string, unknown> | null):
  | {
      ok: true;
      id: string;
      earTag: string;
      checkedAt: string;
      manual: boolean;
      status: "HEALTHY" | "OBSERVATION" | "QUARANTINE" | "SICK";
      reading: { species: "sapi" | "kambing" | "ayam" | "bebek"; temperatureC: number; activityLevel: number; symptoms: SymptomCode[] };
    }
  | { ok: false; message: string } {
  if (!body) return { ok: false, message: "Pemeriksaan tidak valid." };
  const id = body.id;
  const earTag = typeof body.earTag === "string" ? body.earTag.trim().toUpperCase() : "";
  const checkedAt = body.checkedAt;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return { ok: false, message: "Pemeriksaan tidak valid." };
  if (earTag.length < 3 || earTag.length > 16) return { ok: false, message: "Nomor telinga tidak valid." };
  if (typeof checkedAt !== "string" || Number.isNaN(new Date(checkedAt).getTime())) {
    return { ok: false, message: "Waktu pemeriksaan tidak valid." };
  }
  if (!isSpecies(body.species)) return { ok: false, message: "Jenis ternak tidak valid." };
  const temperatureC = Number(body.temperatureC);
  const activityLevel = Number(body.activityLevel);
  if (!Number.isFinite(temperatureC) || temperatureC < 34 || temperatureC > 45) {
    return { ok: false, message: "Suhu harus antara 34 dan 45°C." };
  }
  if (!Number.isInteger(activityLevel) || activityLevel < 0 || activityLevel > 100) {
    return { ok: false, message: "Aktivitas harus bilangan 0–100." };
  }
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms.filter(isSymptom) : [];
  if (Array.isArray(body.symptoms) && symptoms.length !== body.symptoms.length) {
    return { ok: false, message: "Gejala tidak dikenal." };
  }
  const manual = body.manual === true;
  const status = isCheckStatus(body.status) ? body.status : "HEALTHY";
  if (manual && !isCheckStatus(body.status)) return { ok: false, message: "Status kesehatan tidak valid." };
  return {
    ok: true,
    id,
    earTag,
    checkedAt,
    manual,
    status,
    reading: {
      species: body.species,
      temperatureC: Math.round(temperatureC * 10) / 10,
      activityLevel,
      symptoms,
    },
  };
}
