import { connection } from "next/server";
import { isCheckStatus, isSpecies, isSymptom, type SymptomCode } from "@/lib/health";
import { authorize } from "@/lib/session";
import { persistTreatmentCase } from "@/lib/treatment-db";
import { isProtocolId, recommendTreatment } from "@/lib/treatment-protocols";
import type { MedicineDose, TreatmentCase } from "@/lib/treatment";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("livestock", "update");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parsePayload(body);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });

  if (parsed.treatmentCase.status === "terbuka") {
    const plan = recommendTreatment({
      species: parsed.species,
      status: parsed.status,
      symptoms: parsed.symptoms,
    });
    const allowed = new Set([...plan.medicines.map((medicine) => medicine.id), "lain"]);
    const unknown = parsed.treatmentCase.doses.find((dose) => !allowed.has(dose.medicineId));
    if (unknown) return Response.json({ message: "Obat tidak ada pada protokol ini." }, { status: 400 });
  }

  const saved = await persistTreatmentCase(parsed.treatmentCase);
  return Response.json({ ok: true, role: gate.role, stored: saved.stored, treatmentCase: parsed.treatmentCase });
}

function parsePayload(body: Record<string, unknown> | null):
  | {
      ok: true;
      species: "sapi" | "kambing" | "ayam" | "bebek";
      status: "HEALTHY" | "OBSERVATION" | "QUARANTINE" | "SICK";
      symptoms: SymptomCode[];
      treatmentCase: TreatmentCase;
    }
  | { ok: false; message: string } {
  if (!body || !isSpecies(body.species) || !isCheckStatus(body.status)) {
    return { ok: false, message: "Kasus pengobatan tidak valid." };
  }
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms.filter(isSymptom) : [];
  if (Array.isArray(body.symptoms) && symptoms.length !== body.symptoms.length) {
    return { ok: false, message: "Gejala tidak dikenal." };
  }
  const treatmentCase = parseCase(body.treatmentCase);
  if (!treatmentCase) return { ok: false, message: "Kasus pengobatan tidak valid." };
  return { ok: true, species: body.species, status: body.status, symptoms, treatmentCase };
}

function parseCase(input: unknown): TreatmentCase | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<TreatmentCase>;
  if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
  if (typeof row.earTag !== "string" || row.earTag.trim().length < 3) return null;
  if (typeof row.protocolId !== "string" || !isProtocolId(row.protocolId)) return null;
  if (row.status !== "terbuka" && row.status !== "selesai") return null;
  if (typeof row.openedAt !== "string" || Number.isNaN(new Date(row.openedAt).getTime())) return null;
  if (row.closedAt !== null && (typeof row.closedAt !== "string" || Number.isNaN(new Date(row.closedAt).getTime()))) return null;
  const doses = parseDoses(row.doses);
  if (!doses) return null;
  return {
    id: row.id,
    healthLogId: typeof row.healthLogId === "string" ? row.healthLogId : "",
    earTag: row.earTag.trim().toUpperCase(),
    protocolId: row.protocolId,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.status === "selesai" ? row.closedAt ?? null : null,
    doses,
  };
}

function parseDoses(input: unknown): MedicineDose[] | null {
  if (!Array.isArray(input)) return null;
  const doses: MedicineDose[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const row = item as Partial<MedicineDose>;
    if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
    if (typeof row.medicineId !== "string" || typeof row.medicineName !== "string" || typeof row.amount !== "string") return null;
    if (typeof row.givenAt !== "string" || Number.isNaN(new Date(row.givenAt).getTime())) return null;
    const amount = row.amount.trim();
    if (amount.length < 1 || amount.length > 80) return null;
    doses.push({
      id: row.id,
      medicineId: row.medicineId,
      medicineName: row.medicineName.slice(0, 80),
      amount,
      note: typeof row.note === "string" ? row.note.slice(0, 280) : "",
      givenAt: row.givenAt,
    });
  }
  return doses;
}
