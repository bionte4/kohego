import { parseHealthLogs } from "@/lib/health";
import { parseScheduledTreatments } from "@/lib/medical-schedule";
import { parseMedicalHistory, parseTreatmentCases } from "@/lib/treatment";
import { isIcarRfid } from "@/lib/identification";
import { parseInspections } from "@/lib/inspection";
import { createLivestockSeed, isLifeStage, type Animal, type AnimalGender, type FeedLog, type LivestockBook, type LivestockSpecies, type ProductionBatch, type WeightCheck } from "@/lib/livestock";
import { noteLedgerWrite } from "@/lib/ledger-bus";

export const LIVESTOCK_KEY = "kohego.livestock.v1";

const FALLBACK_BREED: Record<LivestockSpecies, string> = {
  sapi: "Limousin",
  kambing: "Etawa",
  ayam: "Ras petelur",
  bebek: "Peking",
};

function migrateAnimal(raw: Partial<Animal> & Pick<Animal, "id" | "earTag" | "species" | "penId" | "weightKg" | "headcount" | "health" | "note" | "updatedAt">): Animal {
  const flock = raw.species === "ayam" || raw.species === "bebek";
  const gender: AnimalGender = raw.gender === "jantan" || raw.gender === "betina" || raw.gender === "campuran"
    ? raw.gender
    : flock
      ? "campuran"
      : "betina";
  return {
    id: raw.id,
    earTag: raw.earTag,
    species: raw.species,
    breed: raw.breed?.trim() || FALLBACK_BREED[raw.species],
    gender,
    birthDate: raw.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(raw.birthDate) ? raw.birthDate : "2023-01-01",
    penId: raw.penId,
    weightKg: raw.weightKg,
    headcount: raw.headcount,
    health: raw.health,
    note: raw.note,
    updatedAt: raw.updatedAt,
    stage: isLifeStage(raw.stage) ? raw.stage : "dewasa",
    sireTag: typeof raw.sireTag === "string" && raw.sireTag.trim() ? raw.sireTag.trim().toUpperCase() : null,
    damTag: typeof raw.damTag === "string" && raw.damTag.trim() ? raw.damTag.trim().toUpperCase() : null,
    rfid: typeof raw.rfid === "string" && isIcarRfid(raw.rfid.trim()) ? raw.rfid.trim() : "",
  };
}

export function parseLivestockBook(input: unknown): LivestockBook | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as {
    version?: number;
    pens?: LivestockBook["pens"];
    animals?: Animal[];
    waste?: LivestockBook["waste"];
    batches?: ProductionBatch[];
    healthLogs?: unknown;
    treatmentCases?: unknown;
    medicalHistory?: unknown;
    scheduledTreatments?: unknown;
    weightChecks?: unknown;
    feedLogs?: unknown;
    inspections?: unknown;
  };
  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.pens) || !Array.isArray(parsed.animals) || !Array.isArray(parsed.waste)) {
    return null;
  }
  return {
    version: 2,
    pens: parsed.pens,
    animals: parsed.animals.map((item) => migrateAnimal(item)),
    waste: parsed.waste,
    batches: Array.isArray(parsed.batches) ? parsed.batches : [],
    healthLogs: parseHealthLogs(parsed.healthLogs),
    treatmentCases: parseTreatmentCases(parsed.treatmentCases),
    medicalHistory: parseMedicalHistory(parsed.medicalHistory),
    scheduledTreatments: parseScheduledTreatments(parsed.scheduledTreatments),
    weightChecks: parseWeightChecks(parsed.weightChecks),
    feedLogs: parseFeedLogs(parsed.feedLogs),
    inspections: parseInspections(parsed.inspections),
  };
}

function parseWeightChecks(input: unknown): WeightCheck[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<WeightCheck>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.weighedOn !== "string") return [];
    if (typeof row.weightKg !== "number" || !Number.isFinite(row.weightKg)) return [];
    return [{ id: row.id, earTag: row.earTag, weighedOn: row.weighedOn, weightKg: row.weightKg }];
  });
}

function parseFeedLogs(input: unknown): FeedLog[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<FeedLog>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.fedOn !== "string") return [];
    if (typeof row.feedKg !== "number" || !Number.isFinite(row.feedKg)) return [];
    return [{ id: row.id, earTag: row.earTag, fedOn: row.fedOn, feedKg: row.feedKg }];
  });
}

export function loadLivestock(): LivestockBook {
  try {
    const raw = localStorage.getItem(LIVESTOCK_KEY);
    if (!raw) return createLivestockSeed();
    return parseLivestockBook(JSON.parse(raw) as unknown) ?? createLivestockSeed();
  } catch {
    return createLivestockSeed();
  }
}

let quietWrites = false;

export function saveLivestock(book: LivestockBook) {
  try {
    localStorage.setItem(LIVESTOCK_KEY, JSON.stringify(book));
    if (!quietWrites) noteLedgerWrite("livestock");
    return true;
  } catch {
    return false;
  }
}

let memory: LivestockBook | null = null;
let wroteInitial = false;
const listeners = new Set<() => void>();

export function subscribeLivestock(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLivestockClient() {
  if (!memory || memory.version !== 2) {
    memory = loadLivestock();
    wroteInitial = false;
  }
  if (!Array.isArray(memory.batches)) {
    memory = { ...memory, batches: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.healthLogs)) {
    memory = { ...memory, healthLogs: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.treatmentCases)) {
    memory = { ...memory, treatmentCases: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.medicalHistory)) {
    memory = { ...memory, medicalHistory: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.scheduledTreatments)) {
    memory = { ...memory, scheduledTreatments: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.weightChecks)) {
    memory = { ...memory, weightChecks: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.feedLogs)) {
    memory = { ...memory, feedLogs: [] };
    wroteInitial = false;
  }
  if (!Array.isArray(memory.inspections)) {
    memory = { ...memory, inspections: [] };
    wroteInitial = false;
  }
  if (memory.animals.some((animal) => !animal.stage || typeof animal.rfid !== "string")) {
    memory = parseLivestockBook(memory) ?? memory;
    wroteInitial = false;
  }
  if (!wroteInitial) {
    wroteInitial = true;
    saveLivestock(memory);
  }
  return memory;
}

export function getLivestockServer(): LivestockBook | null {
  return null;
}

export function replaceLivestock(next: LivestockBook, options?: { quiet?: boolean }) {
  const previous = quietWrites;
  quietWrites = options?.quiet ?? false;
  memory = next;
  const saved = saveLivestock(next);
  quietWrites = previous;
  listeners.forEach((listener) => listener());
  return saved;
}
