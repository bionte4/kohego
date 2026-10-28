import { PRODUCTS, packageSizeOf } from "@/lib/catalog";
import { noteLedgerWrite } from "@/lib/ledger-bus";
import { createSeed } from "@/lib/seed";
import type { AppData, Partner, Product, Warehouse } from "@/lib/types";

export const STORAGE_KEY = "kohego.dashboard.v2";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function healPartner(value: unknown): Partner | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.name !== "string") return null;
  const geo = asRecord(row.geo);
  const lat = Number(geo?.lat);
  const lng = Number(geo?.lng);
  return {
    ...(row as unknown as Partner),
    geo: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, accuracyM: null } : null,
  };
}

function healWarehouse(value: unknown): Warehouse | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.name !== "string") return null;
  const city = typeof row.city === "string" ? row.city : "";
  const capacity = Number(row.capacity);
  return {
    ...(row as unknown as Warehouse),
    city,
    location: typeof row.location === "string" && row.location.trim() ? row.location : city,
    capacity: Number.isInteger(capacity) && capacity > 0 ? capacity : 2500,
    pic: typeof row.pic === "string" && row.pic.trim() ? row.pic : "Belum diisi",
  };
}

function healProduct(value: unknown): Product | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.label !== "string") return null;
  const product = row as unknown as Product;
  return { ...product, packageSize: product.packageSize ?? packageSizeOf(product) };
}

export function parseSalesBook(input: unknown): AppData | null {
  const parsed = asRecord(input);
  if (!parsed) return null;
  const version = parsed.version;
  if (
    (version !== 2 && version !== 3) ||
    !Array.isArray(parsed.orders) ||
    !Array.isArray(parsed.partners) ||
    !Array.isArray(parsed.warehouses) ||
    !Array.isArray(parsed.stock) ||
    !Array.isArray(parsed.movements) ||
    !parsed.profile ||
    typeof parsed.profile !== "object" ||
    typeof (parsed.profile as { name?: unknown }).name !== "string"
  ) {
    return null;
  }
  const partners = parsed.partners.map(healPartner).filter((item): item is Partner => item !== null);
  const warehouses = parsed.warehouses.map(healWarehouse).filter((item): item is Warehouse => item !== null);
  const storedProducts = Array.isArray(parsed.products) ? parsed.products.map(healProduct).filter((item): item is Product => item !== null) : [];
  if (partners.length === 0 || warehouses.length === 0) return null;
  const base = parsed as unknown as AppData;
  return {
    ...base,
    version: 3,
    partners,
    warehouses,
    products: storedProducts.length > 0 ? storedProducts : PRODUCTS.map((product) => ({ ...product })),
    profile: parsed.profile as AppData["profile"],
  };
}

export function loadState(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeed();
    const healed = parseSalesBook(JSON.parse(raw) as Partial<AppData>);
    return healed ?? createSeed();
  } catch {
    return createSeed();
  }
}

let quietWrites = false;

export function saveState(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!quietWrites) noteLedgerWrite("sales");
    return true;
  } catch {
    return false;
  }
}

let memory: AppData | null = null;
let wroteInitial = false;
const listeners = new Set<() => void>();

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Browser snapshot. The first read also writes the seed so a refresh stays stable. */
export function getClientSnapshot() {
  if (!memory || memory.version !== 3 || !Array.isArray(memory.products)) {
    memory = loadState();
    wroteInitial = false;
  }
  if (!wroteInitial) {
    wroteInitial = true;
    saveState(memory);
  }
  return memory;
}

export function getServerSnapshot(): AppData | null {
  return null;
}

export function replaceState(next: AppData, options?: { quiet?: boolean }) {
  const previous = quietWrites;
  quietWrites = options?.quiet ?? false;
  memory = next;
  const saved = saveState(next);
  quietWrites = previous;
  listeners.forEach((listener) => listener());
  return saved;
}
