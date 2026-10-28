import { PRODUCTS } from "@/lib/catalog";
import {
  DRY_PACK_YIELD,
  POC_LITERS_PER_FRESH_KG,
  availableWasteKg,
  conversionVariants,
  SPECIES_LABEL,
  type LivestockBook,
  type LivestockSpecies,
  type ProductionBatch,
  type WasteOutput,
} from "@/lib/livestock";
import type { Product, VariantId } from "@/lib/types";

export interface ProductionEstimate {
  rawKg: number;
  conversionRate: number;
  packageSize: number;
  /** Raw weight multiplied by the conversion rate, in kg or liters. */
  finished: number;
  /** Whole packages: floor(finished / package size). */
  packages: number;
  /** Finished quantity that does not fill another package. */
  unpacked: number;
  unit: "kg" | "L";
}

export type ProductionResult =
  | { ok: true; book: LivestockBook; estimate: ProductionEstimate; batch: ProductionBatch }
  | { ok: false; message: string };

export function packageMeasure(variantId: VariantId, products: Product[] = PRODUCTS) {
  const product = products.find((item) => item.id === variantId);
  if (!product) return null;
  if (product.family === "poc") return { size: product.volumeL, unit: "L" as const, label: product.label, shortLabel: product.shortLabel, unitName: product.unit };
  return { size: product.weightKg, unit: "kg" as const, label: product.label, shortLabel: product.shortLabel, unitName: product.unit };
}

/** Starting rate for the form. Solids use the dry yield. POC uses liters of concentrate per fresh kilogram. */
export function suggestedRate(species: LivestockSpecies, variantId: VariantId, products: Product[] = PRODUCTS) {
  const measure = packageMeasure(variantId, products);
  if (measure?.unit === "L") return POC_LITERS_PER_FRESH_KG;
  return DRY_PACK_YIELD[species] || 0.35;
}

/**
 * Finished packages = floor((rawKg × conversionRate) / packageSize).
 * The rate is the share of fresh kohe that becomes finished product after composting.
 * A rate of 0.8 on 100 kg into 25 kg sacks is 80 / 25 = 3 sacks, with 5 kg left unpacked.
 */
export function estimateProduction(rawKg: number, conversionRate: number, packageSize: number, unit: "kg" | "L"): ProductionEstimate | { ok: false; message: string } {
  if (!Number.isFinite(rawKg) || rawKg <= 0 || rawKg > 10000) {
    return { ok: false, message: "Bobot segar harus di atas 0 dan paling besar 10.000 kg." };
  }
  if (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate > 1) {
    return { ok: false, message: "Rasio konversi harus di atas 0 dan paling besar 1." };
  }
  if (!Number.isFinite(packageSize) || packageSize <= 0) {
    return { ok: false, message: "Ukuran kemasan tidak valid." };
  }
  const finished = rawKg * conversionRate;
  const packages = Math.floor(finished / packageSize + 1e-6);
  const unpacked = Math.round((finished - packages * packageSize) * 10) / 10;
  return {
    rawKg,
    conversionRate,
    packageSize,
    finished: Math.round(finished * 10) / 10,
    packages,
    unpacked,
    unit,
  };
}

/**
 * Marks a batch selesai: draws fresh kohe FIFO from the oldest available log,
 * then records the whole-package yield. Packaged stock is applied by the caller.
 */
export function settleProduction(
  book: LivestockBook,
  input: {
    id: string;
    species: LivestockSpecies;
    rawKg: number;
    conversionRate: number;
    variantId: VariantId;
    warehouseId: string;
    nowIso: string;
    products?: Product[];
  },
): ProductionResult {
  const products = input.products ?? PRODUCTS;
  if (!conversionVariants(input.species, products).includes(input.variantId)) {
    return { ok: false, message: "SKU itu tidak dibuat dari kohe ini." };
  }
  const measure = packageMeasure(input.variantId, products);
  if (!measure) return { ok: false, message: "Varian tidak dikenal." };
  const estimate = estimateProduction(input.rawKg, input.conversionRate, measure.size, measure.unit);
  if ("ok" in estimate) return estimate;
  if (estimate.packages < 1) {
    return { ok: false, message: "Hasil belum cukup untuk satu kemasan. Naikkan bobot atau rasio." };
  }
  const available = availableWasteKg(book.waste, input.species);
  if (input.rawKg - available > 0.05) {
    return { ok: false, message: `Kohe ${SPECIES_LABEL[input.species]} tersedia ${round1(available)} kg.` };
  }
  const drawn = drawWaste(book.waste, input.species, input.rawKg);
  if (!drawn) return { ok: false, message: "Kohe tersedia tidak mencukupi." };
  const batch: ProductionBatch = {
    id: input.id,
    species: input.species,
    rawKg: round1(input.rawKg),
    conversionRate: input.conversionRate,
    variantId: input.variantId,
    packageSize: measure.size,
    outputUnits: estimate.packages,
    warehouseId: input.warehouseId,
    status: "selesai",
    completedAt: input.nowIso,
  };
  return {
    ok: true,
    estimate,
    batch,
    book: { ...book, waste: drawn, batches: [batch, ...(book.batches ?? [])] },
  };
}

function drawWaste(waste: WasteOutput[], species: LivestockSpecies, rawKg: number) {
  const next = waste.map((row) => ({ ...row }));
  const order = next
    .map((row, index) => ({ row, index }))
    .filter((item) => item.row.species === species && item.row.status === "tersedia" && item.row.massKg > 0)
    .sort((a, b) => a.row.collectedAt.localeCompare(b.row.collectedAt));
  let need = rawKg;
  for (const item of order) {
    if (need <= 0.05) break;
    const take = Math.min(item.row.massKg, need);
    need -= take;
    const left = round1(item.row.massKg - take);
    next[item.index] = left <= 0.05 ? { ...item.row, massKg: 0, status: "masuk_produksi" } : { ...item.row, massKg: left };
  }
  if (need > 0.05) return null;
  return next;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
