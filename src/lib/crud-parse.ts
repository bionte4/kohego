import { SPECIES_ORDER, type AnimalDraft, type AnimalGender, type HealthStatus, type LivestockSpecies, type PenDraft } from "@/lib/livestock";
import { PACKAGE_SIZES, type OpnameDraft, type OrderDraft, type PackageSize, type PartnerDraft, type PartnerType, type PaymentMethod, type ProductDraft, type ProductFamilyId, type ReceiptDraft, type TransferDraft, type VariantId, type WarehouseDraft } from "@/lib/types";

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function record(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function variant(value: unknown): VariantId | null {
  const id = text(value);
  if (!id || id.length > 80) return null;
  return id;
}

function coordinate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(text(value));
  return Number.isFinite(number) ? number : Number.NaN;
}

const PARTNER_TYPES: PartnerType[] = ["toko_tani", "perkebunan", "urban"];
const PAYMENTS: PaymentMethod[] = ["tunai", "transfer", "konsinyasi"];
const GENDERS: AnimalGender[] = ["jantan", "betina", "campuran"];
const HEALTH: HealthStatus[] = ["sehat", "pantau", "sakit", "karantina", "terjual"];

export function parsePartnerDraft(body: unknown): Parsed<PartnerDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const type = data.type;
  if (typeof type !== "string" || !PARTNER_TYPES.includes(type as PartnerType)) {
    return { ok: false, message: "Jenis mitra tidak dikenal." };
  }
  const creditTermsDays = Number(data.creditTermsDays);
  const creditLimitIdr = Number(data.creditLimitIdr);
  if (!Number.isInteger(creditTermsDays) || !Number.isInteger(creditLimitIdr)) {
    return { ok: false, message: "Tenor dan plafon harus bilangan." };
  }
  const point = record(data.geo);
  const lat = coordinate(point ? point.lat : data.lat);
  const lng = coordinate(point ? point.lng : data.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { ok: false, message: "Koordinat tidak valid." };
  if ((lat === null) !== (lng === null)) return { ok: false, message: "Isi lintang dan bujur bersama-sama." };
  return {
    ok: true,
    value: {
      name: text(data.name),
      type: type as PartnerType,
      contactName: text(data.contactName),
      phone: text(data.phone),
      address: text(data.address),
      city: text(data.city),
      region: text(data.region),
      creditTermsDays,
      creditLimitIdr,
      geo: lat === null || lng === null ? null : { lat, lng, accuracyM: null },
    },
  };
}

export function parseId(body: unknown): Parsed<string> {
  const data = record(body);
  const id = text(data?.id);
  if (!id) return { ok: false, message: "Id tidak ada." };
  return { ok: true, value: id };
}

export function parseOrderDraft(body: unknown): Parsed<OrderDraft> {
  const data = record(body);
  if (!data || !Array.isArray(data.lines)) return { ok: false, message: "Permintaan tidak valid." };
  const payment = data.payment;
  if (typeof payment !== "string" || !PAYMENTS.includes(payment as PaymentMethod)) {
    return { ok: false, message: "Metode bayar tidak dikenal." };
  }
  const lines = data.lines.map((line) => {
    const row = record(line);
    const item = variant(row?.variant);
    const qty = Number(row?.qty);
    if (!item || !Number.isInteger(qty)) return null;
    return { variant: item, qty };
  });
  if (lines.some((line) => line === null)) return { ok: false, message: "Varian produk tidak dikenal." };
  let geo: OrderDraft["geo"] = null;
  if (data.geo) {
    const point = record(data.geo);
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, message: "Lokasi tidak valid." };
    const accuracy = point?.accuracyM;
    geo = { lat, lng, accuracyM: typeof accuracy === "number" ? accuracy : null };
  }
  return {
    ok: true,
    value: {
      partnerId: text(data.partnerId),
      warehouseId: text(data.warehouseId),
      lines: lines as OrderDraft["lines"],
      deliveryAddress: text(data.deliveryAddress),
      payment: payment as PaymentMethod,
      geo,
      note: text(data.note),
    },
  };
}

export function parseReceipt(body: unknown): Parsed<ReceiptDraft> {
  const data = record(body);
  const item = variant(data?.variant);
  const qty = Number(data?.qty);
  if (!data || !item || !Number.isInteger(qty)) return { ok: false, message: "Stok masuk tidak valid." };
  return {
    ok: true,
    value: {
      warehouseId: text(data.warehouseId),
      variant: item,
      qty,
      breederName: text(data.breederName),
      note: text(data.note),
    },
  };
}

export function parseTransfer(body: unknown): Parsed<TransferDraft> {
  const data = record(body);
  const item = variant(data?.variant);
  const qty = Number(data?.qty);
  if (!data || !item || !Number.isInteger(qty)) return { ok: false, message: "Kiriman tidak valid." };
  return {
    ok: true,
    value: {
      fromWarehouseId: text(data.fromWarehouseId),
      toWarehouseId: text(data.toWarehouseId),
      variant: item,
      qty,
      note: text(data.note),
    },
  };
}

export function parseWriteOff(body: unknown): Parsed<{ warehouseId: string; variant: VariantId; qty: number }> {
  const data = record(body);
  const item = variant(data?.variant);
  const qty = Number(data?.qty);
  if (!data || !item || !Number.isInteger(qty) || qty < 1) return { ok: false, message: "Koreksi stok tidak valid." };
  return { ok: true, value: { warehouseId: text(data.warehouseId), variant: item, qty } };
}

export function parsePenDraft(body: unknown): Parsed<PenDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const species = data.species;
  const capacity = Number(data.capacity);
  if (typeof species !== "string" || !SPECIES_ORDER.includes(species as LivestockSpecies)) {
    return { ok: false, message: "Jenis ternak tidak dikenal." };
  }
  if (!Number.isInteger(capacity)) return { ok: false, message: "Kapasitas harus bilangan." };
  return {
    ok: true,
    value: {
      name: text(data.name),
      species: species as LivestockSpecies,
      location: text(data.location),
      capacity,
    },
  };
}

export function parseAnimalDraft(body: unknown): Parsed<AnimalDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const species = data.species;
  const gender = data.gender;
  const health = data.health;
  if (typeof species !== "string" || !SPECIES_ORDER.includes(species as LivestockSpecies)) {
    return { ok: false, message: "Jenis ternak tidak dikenal." };
  }
  if (typeof gender !== "string" || !GENDERS.includes(gender as AnimalGender)) {
    return { ok: false, message: "Kelamin tidak dikenal." };
  }
  if (typeof health !== "string" || !HEALTH.includes(health as HealthStatus)) {
    return { ok: false, message: "Status kesehatan tidak dikenal." };
  }
  const weightKg = Number(data.weightKg);
  const headcount = Number(data.headcount);
  if (!Number.isFinite(weightKg) || !Number.isInteger(headcount)) {
    return { ok: false, message: "Bobot atau jumlah ekor tidak valid." };
  }
  return {
    ok: true,
    value: {
      earTag: text(data.earTag),
      species: species as LivestockSpecies,
      breed: text(data.breed),
      gender: gender as AnimalGender,
      birthDate: text(data.birthDate),
      penId: text(data.penId),
      weightKg,
      headcount,
      health: health as HealthStatus,
      note: text(data.note),
    },
  };
}

export function parseAnimalPatch(body: unknown): Parsed<{ id: string; weightKg?: number; health?: HealthStatus }> {
  const data = record(body);
  const id = text(data?.id);
  if (!id) return { ok: false, message: "Id tidak ada." };
  const patch: { id: string; weightKg?: number; health?: HealthStatus } = { id };
  if (data && "weightKg" in data) {
    const weightKg = Number(data.weightKg);
    if (!Number.isFinite(weightKg)) return { ok: false, message: "Bobot tidak valid." };
    patch.weightKg = weightKg;
  }
  if (data && "health" in data) {
    const health = data.health;
    if (typeof health !== "string" || !HEALTH.includes(health as HealthStatus)) {
      return { ok: false, message: "Status kesehatan tidak dikenal." };
    }
    patch.health = health as HealthStatus;
  }
  return { ok: true, value: patch };
}

const PRODUCT_FAMILIES: ProductFamilyId[] = ["kambing", "sapi", "ayam", "poc"];

export function parseWarehouseDraft(body: unknown): Parsed<WarehouseDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const kind = data.kind === "agen" ? "agen" : data.kind === "gudang" ? "gudang" : null;
  const capacity = Number(data.capacity);
  if (!kind) return { ok: false, message: "Jenis lokasi tidak dikenal." };
  if (!Number.isInteger(capacity)) return { ok: false, message: "Kapasitas harus bilangan." };
  return {
    ok: true,
    value: { name: text(data.name), location: text(data.location), capacity, pic: text(data.pic), kind },
  };
}

export function parseProductDraft(body: unknown): Parsed<ProductDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const family = data.family;
  const packageSize = data.packageSize;
  const priceIdr = Number(data.priceIdr);
  const volumeL = data.volumeL === undefined || data.volumeL === "" ? 1 : Number(data.volumeL);
  if (typeof family !== "string" || !PRODUCT_FAMILIES.includes(family as ProductFamilyId)) {
    return { ok: false, message: "Kategori tidak dikenal." };
  }
  if (typeof packageSize !== "string" || !(PACKAGE_SIZES as readonly string[]).includes(packageSize)) {
    return { ok: false, message: "Ukuran kemasan tidak dikenal." };
  }
  if (!Number.isInteger(priceIdr) || !Number.isInteger(volumeL)) {
    return { ok: false, message: "Harga dan volume harus bilangan." };
  }
  return {
    ok: true,
    value: {
      label: text(data.label),
      family: family as ProductFamilyId,
      packageSize: packageSize as PackageSize,
      priceIdr,
      volumeL,
    },
  };
}

export function parseOpname(body: unknown): Parsed<OpnameDraft> {
  const data = record(body);
  if (!data) return { ok: false, message: "Permintaan tidak valid." };
  const item = variant(data.variant);
  const countedQty = Number(data.countedQty);
  if (!item) return { ok: false, message: "Pilih varian produk." };
  if (!Number.isInteger(countedQty)) return { ok: false, message: "Hasil hitung harus bilangan." };
  return { ok: true, value: { warehouseId: text(data.warehouseId), variant: item, countedQty } };
}
