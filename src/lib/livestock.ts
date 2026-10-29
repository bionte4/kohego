import { PRODUCTS } from "@/lib/catalog";
import { herdStatusForCheck, seedHealthLogs, type HealthLog } from "@/lib/health";
import type { MedicalHistoryEntry, TreatmentCase } from "@/lib/treatment";
import type { Product, ProductFamilyId, VariantId } from "@/lib/types";

export type LivestockSpecies = "sapi" | "kambing" | "ayam" | "bebek";

export type AnimalGender = "jantan" | "betina" | "campuran";

/** Clinical state plus sale. Terjual leaves the pen and stops new kohe. */
export type HealthStatus = "sehat" | "pantau" | "sakit" | "karantina" | "terjual";

export type WasteStatus = "tersedia" | "masuk_produksi";

export interface Pen {
  id: string;
  name: string;
  species: LivestockSpecies;
  location: string;
  /** Animals, or birds, the pen is rated to hold. */
  capacity: number;
}

/**
 * One tagged animal, or one poultry lot that shares an ear/lot tag.
 * Cattle and goats are always a single head. Chickens and ducks may be a lot.
 */
export interface Animal {
  id: string;
  earTag: string;
  species: LivestockSpecies;
  breed: string;
  gender: AnimalGender;
  /** Calendar date, YYYY-MM-DD. */
  birthDate: string;
  penId: string;
  /** Live weight of one head. On a poultry lot this is the average bird. */
  weightKg: number;
  headcount: number;
  health: HealthStatus;
  note: string;
  updatedAt: string;
}

/**
 * Fresh manure leaving the pen. This is raw material, not a packaged SKU.
 * `masuk_produksi` means the kilograms were handed to fertilizer production.
 * Packaged sak and jerigen still change only through an inventory receipt.
 */
export interface WasteOutput {
  id: string;
  animalId: string | null;
  penId: string;
  species: LivestockSpecies;
  massKg: number;
  collectedAt: string;
  status: WasteStatus;
  note: string;
}

export interface ProductionBatch {
  id: string;
  species: LivestockSpecies;
  rawKg: number;
  conversionRate: number;
  variantId: VariantId;
  packageSize: number;
  outputUnits: number;
  warehouseId: string;
  status: "selesai";
  completedAt: string;
}

export interface LivestockBook {
  version: 2;
  pens: Pen[];
  animals: Animal[];
  waste: WasteOutput[];
  batches: ProductionBatch[];
  healthLogs: HealthLog[];
  treatmentCases: TreatmentCase[];
  medicalHistory: MedicalHistoryEntry[];
}

export interface AnimalDraft {
  earTag: string;
  species: LivestockSpecies;
  breed: string;
  gender: AnimalGender;
  birthDate: string;
  penId: string;
  weightKg: number;
  headcount: number;
  health: HealthStatus;
  note: string;
}

export interface WasteDraft {
  animalId: string;
  massKg: number;
  note: string;
}

export interface PenDraft {
  name: string;
  species: LivestockSpecies;
  location: string;
  capacity: number;
}

export type LivestockResult =
  | { ok: true; id: string; book: LivestockBook }
  | { ok: false; message: string };

/** Finished-goods family this manure can become. Ducks have no packaged SKU yet. */
export const SPECIES_PRODUCT_FAMILY: Record<LivestockSpecies, ProductFamilyId | null> = {
  sapi: "sapi",
  kambing: "kambing",
  ayam: "ayam",
  bebek: null,
};

export const SPECIES_LABEL: Record<LivestockSpecies, string> = {
  sapi: "Sapi",
  kambing: "Kambing",
  ayam: "Ayam",
  bebek: "Bebek",
};

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  sehat: "Sehat",
  pantau: "Pantau",
  sakit: "Sakit",
  karantina: "Karantina",
  terjual: "Terjual",
};

export const GENDER_LABEL: Record<AnimalGender, string> = {
  jantan: "Jantan",
  betina: "Betina",
  campuran: "Campuran",
};

export const WASTE_STATUS_LABEL: Record<WasteStatus, string> = {
  tersedia: "Bahan baku",
  masuk_produksi: "Masuk produksi",
};

export const SPECIES_ORDER: LivestockSpecies[] = ["sapi", "kambing", "ayam", "bebek"];

/**
 * Fresh manure as a fraction of live weight, per day.
 * This is a planning check against what the keeper recorded, not a lab assay.
 * Sapi ~6% of live weight, kambing ~4%, ayam ~2.5%, bebek ~3%.
 */
export const MANURE_FRACTION_PER_DAY: Record<LivestockSpecies, number> = {
  sapi: 0.06,
  kambing: 0.04,
  ayam: 0.025,
  bebek: 0.03,
};

/**
 * Dry packaged kilograms from 1 kg of fresh manure.
 * Fresh kohe is mostly water. A 25 kg sak is dried, fermented product,
 * so the pen record cannot be copied 1:1 into warehouse stock.
 * Ducks have no solid SKU; their fresh mass can still feed POC.
 */
export const DRY_PACK_YIELD: Record<LivestockSpecies, number> = {
  sapi: 0.35,
  kambing: 0.35,
  ayam: 0.4,
  bebek: 0,
};

/** Liters of POC concentrate planned from 1 kg of fresh manure, any species. */
export const POC_LITERS_PER_FRESH_KG = 0.2;

export function liveWeightKg(animal: Animal) {
  return animal.weightKg * animal.headcount;
}

/**
 * Fresh kohe expected in one day from live weight.
 * Sold animals are already gone. Sick and quarantined animals are withheld:
 * their manure is not part of the composting projection, so a health change
 * to sakit or karantina lowers the daily figure on the next read.
 */
export function manureProjection(animals: Animal[], species?: LivestockSpecies) {
  let includedKg = 0;
  let withheldKg = 0;
  let withheldHeads = 0;
  for (const animal of animals) {
    if (species && animal.species !== species) continue;
    if (animal.health === "terjual") continue;
    const kilograms = liveWeightKg(animal) * MANURE_FRACTION_PER_DAY[animal.species];
    if (animal.health === "sakit" || animal.health === "karantina") {
      withheldKg += kilograms;
      withheldHeads += animal.headcount;
    } else {
      includedKg += kilograms;
    }
  }
  return { includedKg, withheldKg, withheldHeads };
}

/** Expected fresh kohe that can still enter composting. Sick and quarantine are excluded. */
export function expectedDailyManureKg(animals: Animal[], species?: LivestockSpecies) {
  return manureProjection(animals, species).includedKg;
}

export function availableWasteKg(waste: WasteOutput[], species?: LivestockSpecies) {
  return waste.reduce((sum, row) => {
    if (row.status !== "tersedia") return sum;
    if (species && row.species !== species) return sum;
    return sum + row.massKg;
  }, 0);
}

export function createLivestockSeed(): LivestockBook {
  const pens: Pen[] = [
    { id: "pen-sapi", name: "Kandang Sapi Kopeng", species: "sapi", location: "Kopeng, Boyolali", capacity: 40 },
    { id: "pen-kambing", name: "Kandang Kambing Cikole", species: "kambing", location: "Cikole, Lembang", capacity: 80 },
    { id: "pen-ayam", name: "Kandang Ayam Pangalengan", species: "ayam", location: "Pangalengan", capacity: 500 },
    { id: "pen-bebek", name: "Kandang Bebek Lembang", species: "bebek", location: "Lembang", capacity: 120 },
  ];

  const animals: Animal[] = [
    animal("ani-spi-102", "SPI-102", "sapi", "Limousin", "jantan", "2022-04-12", "pen-sapi", 428, 1, "sehat", ""),
    animal("ani-spi-118", "SPI-118", "sapi", "Peranakan Ongole", "betina", "2021-11-03", "pen-sapi", 361, 1, "pantau", "Nafsu makan turun."),
    animal("ani-kmb-014", "KMB-014", "kambing", "Etawa", "betina", "2023-06-18", "pen-kambing", 34, 1, "sehat", ""),
    animal("ani-kmb-021", "KMB-021", "kambing", "Etawa", "jantan", "2023-02-09", "pen-kambing", 29, 1, "sehat", ""),
    animal("ani-kmb-033", "KMB-033", "kambing", "Jawarandu", "jantan", "2022-08-21", "pen-kambing", 41, 1, "sakit", "Pincang kaki belakang."),
    animal("ani-aym-l01", "AYM-L01", "ayam", "ISA Brown", "campuran", "2026-06-01", "pen-ayam", 1.9, 180, "sehat", "Lot petelur, bobot rata-rata."),
    animal("ani-bdk-07", "BDK-07", "bebek", "Peking", "campuran", "2026-07-15", "pen-bebek", 2.4, 60, "sehat", "Lot pedaging."),
    animal("ani-bdk-12", "BDK-12", "bebek", "Peking", "betina", "2026-05-02", "pen-bebek", 2.1, 1, "karantina", "Dipisah dari lot."),
  ];

  const waste: WasteOutput[] = [
    wasteRow("wst-01", "ani-spi-102", "pen-sapi", "sapi", 86, "2026-10-27T01:30:00.000Z", "tersedia", "Pagi, padat."),
    wasteRow("wst-02", "ani-kmb-014", "pen-kambing", "kambing", 18, "2026-10-27T02:10:00.000Z", "tersedia", ""),
    wasteRow("wst-03", "ani-aym-l01", "pen-ayam", "ayam", 22, "2026-10-26T03:00:00.000Z", "masuk_produksi", "Sudah ke fermentasi."),
    wasteRow("wst-04", "ani-bdk-07", "pen-bebek", "bebek", 9, "2026-10-27T04:20:00.000Z", "tersedia", "Belum ada SKU kemasan."),
  ];

  const healthLogs = seedHealthLogs();
  const checked = new Map(healthLogs.map((log) => [log.earTag, herdStatusForCheck(log.status)]));
  const herd = animals.map((item) => {
    const health = checked.get(item.earTag);
    return health ? { ...item, health } : item;
  });

  return { version: 2, pens, animals: herd, waste, batches: [], healthLogs, treatmentCases: [], medicalHistory: [] };
}

function animal(
  id: string,
  earTag: string,
  species: LivestockSpecies,
  breed: string,
  gender: AnimalGender,
  birthDate: string,
  penId: string,
  weightKg: number,
  headcount: number,
  health: HealthStatus,
  note: string,
): Animal {
  return {
    id,
    earTag,
    species,
    breed,
    gender,
    birthDate,
    penId,
    weightKg,
    headcount,
    health,
    note,
    updatedAt: "2026-10-27T08:00:00.000Z",
  };
}

function wasteRow(
  id: string,
  animalId: string,
  penId: string,
  species: LivestockSpecies,
  massKg: number,
  collectedAt: string,
  status: WasteStatus,
  note: string,
): WasteOutput {
  return { id, animalId, penId, species, massKg, collectedAt, status, note };
}

export function addPen(book: LivestockBook, draft: PenDraft, id: string): LivestockResult {
  const name = draft.name.trim();
  const location = draft.location.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, message: "Isi nama kandang, 2–60 karakter." };
  if (location.length < 2 || location.length > 80) return { ok: false, message: "Isi lokasi kandang." };
  if (!SPECIES_ORDER.includes(draft.species)) return { ok: false, message: "Jenis ternak tidak dikenal." };
  if (!Number.isInteger(draft.capacity) || draft.capacity < 1 || draft.capacity > 100_000) {
    return { ok: false, message: "Kapasitas harus bilangan ekor antara 1 dan 100.000." };
  }
  if (book.pens.some((pen) => pen.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: "Nama kandang sudah terpakai." };
  }
  const pen: Pen = { id, name, species: draft.species, location, capacity: draft.capacity };
  return { ok: true, id, book: { ...book, pens: [...book.pens, pen] } };
}

export function addAnimal(book: LivestockBook, draft: AnimalDraft, id: string, nowIso: string): LivestockResult {
  const earTag = draft.earTag.trim().toUpperCase();
  if (earTag.length < 3 || earTag.length > 16) {
    return { ok: false, message: "Nomor telinga 3–16 karakter." };
  }
  if (book.animals.some((item) => item.earTag.toUpperCase() === earTag)) {
    return { ok: false, message: "Nomor telinga sudah terpakai." };
  }
  const breed = draft.breed.trim();
  if (breed.length < 2 || breed.length > 40) {
    return { ok: false, message: "Isi ras, 2–40 karakter." };
  }
  if (!isBirthDate(draft.birthDate, nowIso)) {
    return { ok: false, message: "Tanggal lahir tidak valid." };
  }
  const pen = book.pens.find((item) => item.id === draft.penId);
  if (!pen || pen.species !== draft.species) {
    return { ok: false, message: "Pilih kandang yang sesuai jenis ternak." };
  }
  if (!Number.isFinite(draft.weightKg) || draft.weightKg <= 0 || draft.weightKg > 1500) {
    return { ok: false, message: "Bobot harus di atas 0 dan paling besar 1.500 kg." };
  }
  const flock = draft.species === "ayam" || draft.species === "bebek";
  if (!flock && draft.headcount !== 1) {
    return { ok: false, message: "Sapi dan kambing dicatat per ekor, satu nomor telinga." };
  }
  if (!Number.isInteger(draft.headcount) || draft.headcount < 1 || draft.headcount > 9999) {
    return { ok: false, message: "Jumlah ekor harus bilangan 1–9999." };
  }
  const heads = book.animals
    .filter((item) => item.penId === pen.id && item.health !== "terjual")
    .reduce((sum, item) => sum + item.headcount, 0);
  const incoming = draft.health === "terjual" ? 0 : draft.headcount;
  if (heads + incoming > pen.capacity) {
    return { ok: false, message: `Kandang ini muat ${pen.capacity} ekor. Terisi ${heads}.` };
  }

  const next: Animal = {
    id,
    earTag,
    species: draft.species,
    breed,
    gender: draft.gender,
    birthDate: draft.birthDate,
    penId: pen.id,
    weightKg: Math.round(draft.weightKg * 10) / 10,
    headcount: draft.headcount,
    health: draft.health,
    note: draft.note.trim().slice(0, 280),
    updatedAt: nowIso,
  };
  return { ok: true, id, book: { ...book, animals: [next, ...book.animals] } };
}

export function replaceAnimal(book: LivestockBook, animalId: string, draft: AnimalDraft, nowIso: string): LivestockResult {
  const current = book.animals.find((item) => item.id === animalId);
  if (!current) return { ok: false, message: "Ternak tidak ditemukan." };
  const earTag = draft.earTag.trim().toUpperCase();
  if (earTag.length < 3 || earTag.length > 16) return { ok: false, message: "Nomor telinga 3–16 karakter." };
  if (book.animals.some((item) => item.id !== current.id && item.earTag.toUpperCase() === earTag)) {
    return { ok: false, message: "Nomor telinga sudah terpakai." };
  }
  const breed = draft.breed.trim();
  if (breed.length < 2 || breed.length > 40) return { ok: false, message: "Isi ras, 2–40 karakter." };
  if (!isBirthDate(draft.birthDate, nowIso)) return { ok: false, message: "Tanggal lahir tidak valid." };
  const pen = book.pens.find((item) => item.id === draft.penId);
  if (!pen || pen.species !== draft.species) return { ok: false, message: "Pilih kandang yang sesuai jenis ternak." };
  if (!Number.isFinite(draft.weightKg) || draft.weightKg <= 0 || draft.weightKg > 1500) {
    return { ok: false, message: "Bobot harus di atas 0 dan paling besar 1.500 kg." };
  }
  const flock = draft.species === "ayam" || draft.species === "bebek";
  if (!flock && draft.headcount !== 1) {
    return { ok: false, message: "Sapi dan kambing dicatat per ekor, satu nomor telinga." };
  }
  if (!Number.isInteger(draft.headcount) || draft.headcount < 1 || draft.headcount > 9999) {
    return { ok: false, message: "Jumlah ekor harus bilangan 1–9999." };
  }
  const heads = book.animals
    .filter((item) => item.id !== current.id && item.penId === pen.id && item.health !== "terjual")
    .reduce((sum, item) => sum + item.headcount, 0);
  const incoming = draft.health === "terjual" ? 0 : draft.headcount;
  if (heads + incoming > pen.capacity) {
    return { ok: false, message: `Kandang ini muat ${pen.capacity} ekor. Terisi ${heads}.` };
  }
  const next: Animal = {
    ...current,
    earTag,
    species: draft.species,
    breed,
    gender: draft.gender,
    birthDate: draft.birthDate,
    penId: pen.id,
    weightKg: Math.round(draft.weightKg * 10) / 10,
    headcount: draft.headcount,
    health: draft.health,
    note: draft.note.trim().slice(0, 280),
    updatedAt: nowIso,
  };
  return {
    ok: true,
    id: current.id,
    book: { ...book, animals: book.animals.map((item) => (item.id === current.id ? next : item)) },
  };
}

export function updateAnimal(
  book: LivestockBook,
  animalId: string,
  patch: { weightKg?: number; health?: HealthStatus },
  nowIso: string,
): LivestockResult {
  const current = book.animals.find((item) => item.id === animalId);
  if (!current) return { ok: false, message: "Ternak tidak ditemukan." };
  const weightKg = patch.weightKg ?? current.weightKg;
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 1500) {
    return { ok: false, message: "Bobot harus di atas 0 dan paling besar 1.500 kg." };
  }
  return {
    ok: true,
    id: current.id,
    book: {
      ...book,
      animals: book.animals.map((item) =>
        item.id === current.id
          ? { ...item, weightKg: Math.round(weightKg * 10) / 10, health: patch.health ?? item.health, updatedAt: nowIso }
          : item,
      ),
    },
  };
}

export function removeAnimal(book: LivestockBook, animalId: string): LivestockResult {
  const current = book.animals.find((item) => item.id === animalId);
  if (!current) return { ok: false, message: "Ternak tidak ditemukan." };
  const holding = book.waste.some((item) => item.animalId === current.id && item.status === "tersedia" && item.massKg > 0);
  if (holding) return { ok: false, message: "Masih ada kohe tersedia dari ternak ini." };
  return {
    ok: true,
    id: current.id,
    book: { ...book, animals: book.animals.filter((item) => item.id !== current.id) },
  };
}

export function recordWaste(book: LivestockBook, draft: WasteDraft, id: string, nowIso: string): LivestockResult {
  const source = book.animals.find((item) => item.id === draft.animalId);
  if (!source) return { ok: false, message: "Pilih ternak asal kotoran." };
  if (source.health === "terjual") return { ok: false, message: "Ternak yang sudah terjual tidak menghasilkan kohe." };
  if (!Number.isFinite(draft.massKg) || draft.massKg <= 0 || draft.massKg > 10000) {
    return { ok: false, message: "Massa kohe harus di atas 0 dan paling besar 10.000 kg." };
  }
  const row: WasteOutput = {
    id,
    animalId: source.id,
    penId: source.penId,
    species: source.species,
    massKg: Math.round(draft.massKg * 10) / 10,
    collectedAt: nowIso,
    status: "tersedia",
    note: draft.note.trim().slice(0, 280),
  };
  return { ok: true, id, book: { ...book, waste: [row, ...book.waste] } };
}

export function allocateWaste(book: LivestockBook, wasteId: string): LivestockResult {
  const row = book.waste.find((item) => item.id === wasteId);
  if (!row) return { ok: false, message: "Catatan kohe tidak ditemukan." };
  if (row.status === "masuk_produksi") return { ok: false, message: "Kohe ini sudah masuk produksi." };
  if (SPECIES_PRODUCT_FAMILY[row.species] === null) {
    return { ok: false, message: "Kohe bebek belum punya SKU pupuk padat. Konversi lewat POC." };
  }
  return {
    ok: true,
    id: row.id,
    book: {
      ...book,
      waste: book.waste.map((item) => (item.id === row.id ? { ...item, status: "masuk_produksi" } : item)),
    },
  };
}

export type PackPlan = { ok: true; freshKg: number } | { ok: false; message: string };

export function conversionVariants(species: LivestockSpecies, products: Product[] = PRODUCTS): VariantId[] {
  const family = SPECIES_PRODUCT_FAMILY[species];
  const solids = family ? products.filter((product) => product.family === family) : [];
  const poc = products.filter((product) => product.family === "poc");
  return [...solids, ...poc].map((product) => product.id);
}

/** Largest whole-package count this fresh lot can support for one SKU. */
export function maxPackages(massKg: number, species: LivestockSpecies, variant: VariantId, products: Product[] = PRODUCTS) {
  const product = products.find((item) => item.id === variant);
  if (!product) return 0;
  if (product.family === "poc") {
    if (product.volumeL <= 0) return 0;
    return Math.floor((massKg * POC_LITERS_PER_FRESH_KG) / product.volumeL);
  }
  if (product.family !== SPECIES_PRODUCT_FAMILY[species]) return 0;
  const yieldRatio = DRY_PACK_YIELD[species];
  if (yieldRatio <= 0 || product.weightKg <= 0) return 0;
  return Math.floor((massKg * yieldRatio) / product.weightKg);
}

/**
 * Fresh kilograms consumed to pack `packages` of the SKU.
 * Solids divide packaged kilograms by the dry yield. POC divides liters by the ferment factor.
 */
export function freshKgForPackages(packages: number, species: LivestockSpecies, variant: VariantId, products: Product[] = PRODUCTS) {
  const product = products.find((item) => item.id === variant);
  if (!product || packages <= 0) return 0;
  if (product.family === "poc") return (packages * product.volumeL) / POC_LITERS_PER_FRESH_KG;
  const yieldRatio = DRY_PACK_YIELD[species];
  if (yieldRatio <= 0) return Number.POSITIVE_INFINITY;
  return (packages * product.weightKg) / yieldRatio;
}

export function planWastePack(row: WasteOutput, variant: VariantId, packages: number, products: Product[] = PRODUCTS): PackPlan {
  if (row.status !== "tersedia") return { ok: false, message: "Kohe ini sudah masuk produksi." };
  if (!Number.isInteger(packages) || packages < 1) {
    return { ok: false, message: "Jumlah kemasan harus bilangan bulat minimal 1." };
  }
  if (!conversionVariants(row.species, products).includes(variant)) {
    return { ok: false, message: "SKU itu tidak dibuat dari kohe ini." };
  }
  const cap = maxPackages(row.massKg, row.species, variant, products);
  if (packages > cap) {
    return {
      ok: false,
      message: cap < 1 ? "Massa segar belum cukup untuk satu kemasan." : `Cukup untuk ${cap} kemasan.`,
    };
  }
  return { ok: true, freshKg: freshKgForPackages(packages, row.species, variant, products) };
}

export function issueWaste(book: LivestockBook, wasteId: string, freshKg: number): LivestockResult {
  const row = book.waste.find((item) => item.id === wasteId);
  if (!row) return { ok: false, message: "Catatan kohe tidak ditemukan." };
  if (row.status !== "tersedia") return { ok: false, message: "Kohe ini sudah masuk produksi." };
  if (!Number.isFinite(freshKg) || freshKg <= 0) return { ok: false, message: "Massa konversi tidak valid." };
  if (freshKg - row.massKg > 0.05) return { ok: false, message: "Massa segar tidak mencukupi." };
  const left = Math.round((row.massKg - freshKg) * 10) / 10;
  const finished = left <= 0.05;
  return {
    ok: true,
    id: row.id,
    book: {
      ...book,
      waste: book.waste.map((item) =>
        item.id === row.id
          ? { ...item, massKg: finished ? 0 : left, status: finished ? "masuk_produksi" : "tersedia" }
          : item,
      ),
    },
  };
}

function isBirthDate(value: string, nowIso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  if (year < 2000) return false;
  return value <= nowIso.slice(0, 10);
}
