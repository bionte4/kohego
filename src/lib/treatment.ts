import type { HealthCheckStatus, HealthLog, SymptomCode } from "@/lib/health";
import { isCheckStatus, isSymptom } from "@/lib/health";
import type { LivestockBook } from "@/lib/livestock";
import { assistTreatment } from "@/lib/treatment-assistant";
import { isProtocolId, protocolById, recommendTreatment, type ProtocolSeverity } from "@/lib/treatment-protocols";

export type TreatmentCaseStatus = "terbuka" | "selesai";

export interface MedicineDose {
  id: string;
  medicineId: string;
  medicineName: string;
  amount: string;
  note: string;
  givenAt: string;
  /** Days printed on the product label. Zero means no meat or milk hold. */
  withdrawalDays?: number;
}

export interface MedicalHistoryEntry {
  id: string;
  earTag: string;
  healthLogId: string;
  protocolId: string;
  protocolName: string;
  summary: string;
  isolation: string;
  appliedAt: string;
}

export interface TreatmentCase {
  id: string;
  healthLogId: string;
  earTag: string;
  protocolId: string;
  status: TreatmentCaseStatus;
  openedAt: string;
  closedAt: string | null;
  doses: MedicineDose[];
}

export function openCaseFor(cases: TreatmentCase[] | undefined, earTag: string) {
  return (cases ?? []).find((item) => item.earTag === earTag && item.status === "terbuka") ?? null;
}

export function recordMedicine(
  book: LivestockBook,
  animalId: string,
  input: { medicineId: string; amount: string; note: string; withdrawalDays?: number },
  ids: { caseId: string; doseId: string },
  nowIso: string,
): { ok: true; book: LivestockBook; treatmentCase: TreatmentCase } | { ok: false; message: string } {
  const animal = book.animals.find((item) => item.id === animalId);
  if (!animal) return { ok: false, message: "Ternak tidak ditemukan." };
  if (animal.health === "terjual") return { ok: false, message: "Ternak yang sudah terjual tidak diobati." };
  const amount = input.amount.trim();
  if (amount.length < 1 || amount.length > 80) return { ok: false, message: "Isi jumlah obat yang diberikan, paling panjang 80 karakter." };
  const withdrawalDays = input.withdrawalDays ?? 0;
  if (!Number.isInteger(withdrawalDays) || withdrawalDays < 0 || withdrawalDays > 45) {
    return { ok: false, message: "Hari henti obat mengikuti label, 0–45 hari." };
  }
  const log = latestLog(book, animal.earTag);
  const status = log?.status ?? statusFromHerd(animal.health);
  const symptoms = log?.symptoms ?? [];
  const plan = recommendTreatment({ species: animal.species, status, symptoms });
  const listed = plan.medicines.some((medicine) => medicine.id === input.medicineId);
  const custom = input.medicineId === "lain";
  if (!listed && !custom) return { ok: false, message: "Pilih obat dari protokol." };
  const medicineName = listed
    ? plan.medicines.find((medicine) => medicine.id === input.medicineId)?.name ?? "Obat"
    : "Tindakan lain";
  const dose: MedicineDose = {
    id: ids.doseId,
    medicineId: input.medicineId,
    medicineName,
    amount,
    note: input.note.trim().slice(0, 280),
    givenAt: nowIso,
    withdrawalDays,
  };
  const cases = book.treatmentCases ?? [];
  const existing = openCaseFor(cases, animal.earTag);
  const treatmentCase: TreatmentCase = existing
    ? { ...existing, protocolId: plan.protocol.id, healthLogId: log?.id ?? existing.healthLogId, doses: [dose, ...existing.doses] }
    : {
        id: ids.caseId,
        healthLogId: log?.id ?? "",
        earTag: animal.earTag,
        protocolId: plan.protocol.id,
        status: "terbuka",
        openedAt: nowIso,
        closedAt: null,
        doses: [dose],
      };
  return { ok: true, treatmentCase, book: saveCase(book, treatmentCase) };
}

export function applyProtocol(
  book: LivestockBook,
  animalId: string,
  id: string,
  nowIso: string,
): { ok: true; book: LivestockBook; entry: MedicalHistoryEntry } | { ok: false; message: string } {
  const found = recommendationFor(book, animalId);
  if (!found) return { ok: false, message: "Ternak tidak ditemukan." };
  const advice = assistTreatment({
    species: found.animal.species,
    status: found.status,
    symptoms: found.symptoms,
    temperatureC: found.log?.temperatureC ?? null,
    activityLevel: found.log?.activityLevel ?? null,
  });
  const healthLogId = found.log?.id ?? "";
  const history = book.medicalHistory ?? [];
  const already = history.some(
    (item) => item.earTag === found.animal.earTag && item.protocolId === advice.plan.protocol.id && item.healthLogId === healthLogId,
  );
  if (already) return { ok: false, message: "Protokol ini sudah dicatat pada pemeriksaan yang sama." };
  const entry: MedicalHistoryEntry = {
    id,
    earTag: found.animal.earTag,
    healthLogId,
    protocolId: advice.plan.protocol.id,
    protocolName: advice.plan.protocol.name,
    summary: advice.narrative,
    isolation: advice.isolation,
    appliedAt: nowIso,
  };
  return { ok: true, entry, book: { ...book, medicalHistory: [entry, ...history] } };
}

export function closeTreatmentCase(
  book: LivestockBook,
  caseId: string,
  nowIso: string,
): { ok: true; book: LivestockBook; treatmentCase: TreatmentCase } | { ok: false; message: string } {
  const current = (book.treatmentCases ?? []).find((item) => item.id === caseId);
  if (!current) return { ok: false, message: "Kasus pengobatan tidak ditemukan." };
  if (current.status === "selesai") return { ok: false, message: "Kasus ini sudah ditutup." };
  const treatmentCase: TreatmentCase = { ...current, status: "selesai", closedAt: nowIso };
  return { ok: true, treatmentCase, book: saveCase(book, treatmentCase) };
}

export function parseTreatmentCases(input: unknown): TreatmentCase[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<TreatmentCase>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.openedAt !== "string") return [];
    if (row.status !== "terbuka" && row.status !== "selesai") return [];
    if (typeof row.protocolId !== "string" || !isProtocolId(row.protocolId)) return [];
    return [
      {
        id: row.id,
        healthLogId: typeof row.healthLogId === "string" ? row.healthLogId : "",
        earTag: row.earTag,
        protocolId: row.protocolId,
        status: row.status,
        openedAt: row.openedAt,
        closedAt: typeof row.closedAt === "string" ? row.closedAt : null,
        doses: parseDoses(row.doses),
      },
    ];
  });
}

export function recommendationFor(book: LivestockBook, animalId: string) {
  const animal = book.animals.find((item) => item.id === animalId);
  if (!animal || animal.health === "terjual") return null;
  const log = latestLog(book, animal.earTag);
  const status = log?.status ?? statusFromHerd(animal.health);
  const symptoms = log?.symptoms ?? [];
  const plan = recommendTreatment({ species: animal.species, status, symptoms });
  return { animal, log, plan, status, symptoms };
}

export function doseAllowed(protocolId: string, medicineId: string, species: LivestockBook["animals"][number]["species"]) {
  if (medicineId === "lain") return true;
  const protocol = protocolById(protocolId);
  return protocol.medicines.some((medicine) => medicine.id === medicineId && medicine.dosage[species]);
}

function saveCase(book: LivestockBook, treatmentCase: TreatmentCase): LivestockBook {
  const cases = book.treatmentCases ?? [];
  const rest = cases.filter((item) => item.id !== treatmentCase.id);
  return { ...book, treatmentCases: [treatmentCase, ...rest] };
}

function latestLog(book: LivestockBook, earTag: string): HealthLog | null {
  return (book.healthLogs ?? [])
    .filter((log) => log.earTag === earTag)
    .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0] ?? null;
}

function statusFromHerd(health: LivestockBook["animals"][number]["health"]): HealthCheckStatus {
  if (health === "pantau") return "OBSERVATION";
  if (health === "karantina") return "QUARANTINE";
  if (health === "sakit") return "SICK";
  return "HEALTHY";
}

function parseDoses(input: unknown): MedicineDose[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<MedicineDose>;
    if (typeof row.id !== "string" || typeof row.medicineId !== "string" || typeof row.givenAt !== "string") return [];
    if (typeof row.amount !== "string" || typeof row.medicineName !== "string") return [];
    return [
      {
        id: row.id,
        medicineId: row.medicineId,
        medicineName: row.medicineName,
        amount: row.amount,
        note: typeof row.note === "string" ? row.note : "",
        givenAt: row.givenAt,
        withdrawalDays: Number.isInteger(row.withdrawalDays) && (row.withdrawalDays ?? 0) >= 0 && (row.withdrawalDays ?? 0) <= 45 ? row.withdrawalDays : 0,
      },
    ];
  });
}

export function parseMedicalHistory(input: unknown): MedicalHistoryEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<MedicalHistoryEntry>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.appliedAt !== "string") return [];
    if (typeof row.protocolId !== "string" || !isProtocolId(row.protocolId)) return [];
    if (typeof row.protocolName !== "string" || typeof row.summary !== "string" || typeof row.isolation !== "string") return [];
    return [
      {
        id: row.id,
        earTag: row.earTag,
        healthLogId: typeof row.healthLogId === "string" ? row.healthLogId : "",
        protocolId: row.protocolId,
        protocolName: row.protocolName,
        summary: row.summary,
        isolation: row.isolation,
        appliedAt: row.appliedAt,
      },
    ];
  });
}

export function isCaseStatus(value: unknown): value is TreatmentCaseStatus {
  return value === "terbuka" || value === "selesai";
}

export function symptomsOf(log: HealthLog | null): SymptomCode[] {
  return (log?.symptoms ?? []).filter(isSymptom);
}

export function checkStatusOf(value: unknown): HealthCheckStatus {
  return isCheckStatus(value) ? value : "HEALTHY";
}

export type { ProtocolSeverity };
