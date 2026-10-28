import type { OrderLine, Product, ProductFamilyId, VariantId } from "@/lib/types";

export interface ProductFamily {
  id: ProductFamilyId;
  label: string;
  blurb: string;
}

export const FAMILIES: ProductFamily[] = [
  { id: "kambing", label: "Kohe Kambing", blurb: "Ritel 5 kg, 10 kg, dan curah 25 kg" },
  { id: "sapi", label: "Kohe Sapi", blurb: "Soil conditioner" },
  { id: "ayam", label: "Kohe Ayam", blurb: "Nitrogen booster" },
  { id: "poc", label: "POC", blurb: "Pupuk organik cair" },
];

export const PRODUCTS: Product[] = [
  {
    id: "kambing-5",
    family: "kambing",
    label: "Kohe Kambing 5 kg",
    shortLabel: "5 kg",
    role: "Ritel",
    weightKg: 5,
    volumeL: 0,
    unit: "sak",
    priceIdr: 28_000,
    sku: "KOHE-KMB-5",
  },
  {
    id: "kambing-10",
    family: "kambing",
    label: "Kohe Kambing 10 kg",
    shortLabel: "10 kg",
    role: "Ritel",
    weightKg: 10,
    volumeL: 0,
    unit: "sak",
    priceIdr: 52_000,
    sku: "KOHE-KMB-10",
  },
  {
    id: "kambing-25",
    family: "kambing",
    label: "Kohe Kambing 25 kg",
    shortLabel: "25 kg",
    role: "Curah",
    weightKg: 25,
    volumeL: 0,
    unit: "sak",
    priceIdr: 115_000,
    sku: "KOHE-KMB-25",
  },
  {
    id: "sapi-10",
    family: "sapi",
    label: "Kohe Sapi 10 kg",
    shortLabel: "10 kg",
    role: "Soil conditioner",
    weightKg: 10,
    volumeL: 0,
    unit: "sak",
    priceIdr: 40_000,
    sku: "KOHE-SPI-10",
  },
  {
    id: "sapi-25",
    family: "sapi",
    label: "Kohe Sapi 25 kg",
    shortLabel: "25 kg",
    role: "Soil conditioner",
    weightKg: 25,
    volumeL: 0,
    unit: "sak",
    priceIdr: 90_000,
    sku: "KOHE-SPI-25",
  },
  {
    id: "ayam-5",
    family: "ayam",
    label: "Kohe Ayam 5 kg",
    shortLabel: "5 kg",
    role: "Nitrogen booster",
    weightKg: 5,
    volumeL: 0,
    unit: "sak",
    priceIdr: 32_000,
    sku: "KOHE-AYM-5",
  },
  {
    id: "ayam-10",
    family: "ayam",
    label: "Kohe Ayam 10 kg",
    shortLabel: "10 kg",
    role: "Nitrogen booster",
    weightKg: 10,
    volumeL: 0,
    unit: "sak",
    priceIdr: 58_000,
    sku: "KOHE-AYM-10",
  },
  {
    id: "poc-1",
    family: "poc",
    label: "POC 1 L",
    shortLabel: "1 L",
    role: "Cair",
    weightKg: 0,
    volumeL: 1,
    unit: "jerigen",
    priceIdr: 35_000,
    sku: "POC-1",
  },
  {
    id: "poc-5",
    family: "poc",
    label: "POC 5 L",
    shortLabel: "5 L",
    role: "Cair",
    weightKg: 0,
    volumeL: 5,
    unit: "jerigen",
    priceIdr: 145_000,
    sku: "POC-5",
  },
];

/**
 * Reorder point in packages. Dry sacks flag below 20. Jerigen flag below 8
 * because a liquid case is smaller than a sack pallet.
 */
export function lowStockLimit(product: Product) {
  return product.unit === "jerigen" ? 8 : 20;
}

/**
 * Package count that fills the stock bar. Larger warehouses cap at 100%
 * so a full central store does not flatten the agent bars.
 */
export const PAR_LEVEL: Record<VariantId, number> = {
  "kambing-5": 120,
  "kambing-10": 100,
  "kambing-25": 180,
  "sapi-10": 80,
  "sapi-25": 120,
  "ayam-5": 80,
  "ayam-10": 90,
  "poc-1": 40,
  "poc-5": 24,
};

export function productsByFamily(family: ProductFamilyId) {
  return PRODUCTS.filter((product) => product.family === family);
}

export function productById(variant: VariantId) {
  const product = PRODUCTS.find((item) => item.id === variant);
  if (!product) {
    throw new Error(`Varian tidak dikenal: ${variant}`);
  }
  return product;
}

export function emptyQuantities(): Record<VariantId, number> {
  return {
    "kambing-5": 0,
    "kambing-10": 0,
    "kambing-25": 0,
    "sapi-10": 0,
    "sapi-25": 0,
    "ayam-5": 0,
    "ayam-10": 0,
    "poc-1": 0,
    "poc-5": 0,
  };
}

/** Freeze the list price, package weight, and volume onto an order line. */
export function snapshotLine(variant: VariantId, qty: number): OrderLine {
  const product = productById(variant);
  return {
    variant,
    qty,
    unitPriceIdr: product.priceIdr,
    weightKg: product.weightKg,
    volumeL: product.volumeL,
  };
}
