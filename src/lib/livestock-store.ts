import { createLivestockSeed, type Animal, type AnimalGender, type LivestockBook, type LivestockSpecies, type ProductionBatch } from "@/lib/livestock";

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

export function loadLivestock(): LivestockBook {
  try {
    const raw = localStorage.getItem(LIVESTOCK_KEY);
    if (!raw) return createLivestockSeed();
    const parsed = JSON.parse(raw) as {
      version?: number;
      pens?: LivestockBook["pens"];
      animals?: Animal[];
      waste?: LivestockBook["waste"];
      batches?: ProductionBatch[];
    };
    if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.pens) || !Array.isArray(parsed.animals) || !Array.isArray(parsed.waste)) {
      return createLivestockSeed();
    }
    return {
      version: 2,
      pens: parsed.pens,
      animals: parsed.animals.map((item) => migrateAnimal(item)),
      waste: parsed.waste,
      batches: Array.isArray(parsed.batches) ? parsed.batches : [],
    };
  } catch {
    return createLivestockSeed();
  }
}

export function saveLivestock(book: LivestockBook) {
  try {
    localStorage.setItem(LIVESTOCK_KEY, JSON.stringify(book));
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
  if (!wroteInitial) {
    wroteInitial = true;
    saveLivestock(memory);
  }
  return memory;
}

export function getLivestockServer(): LivestockBook | null {
  return null;
}

export function replaceLivestock(next: LivestockBook) {
  memory = next;
  const saved = saveLivestock(next);
  listeners.forEach((listener) => listener());
  return saved;
}
