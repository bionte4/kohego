import { parseHealthLogs } from "@/lib/health";
import { parseMedicalHistory, parseTreatmentCases } from "@/lib/treatment";
import { createLivestockSeed, type Animal, type AnimalGender, type LivestockBook, type LivestockSpecies, type ProductionBatch } from "@/lib/livestock";
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
  };
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
