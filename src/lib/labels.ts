import type { MovementKind, PackageSize, PackageUnit, PartnerType, PaymentMethod, ProductFamilyId, Warehouse } from "@/lib/types";

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  toko_tani: "Toko Tani",
  perkebunan: "Perkebunan",
  urban: "Urban Farmer",
};

export const CHANNEL_LABEL = {
  b2b: "B2B",
  b2c: "B2C",
} as const;

export function partnerChannel(type: PartnerType) {
  return type === "urban" ? "b2c" : "b2b";
}

export const PACKAGE_SIZE_LABEL: Record<PackageSize, string> = {
  "5kg": "5 kg",
  "10kg": "10 kg",
  "25kg": "25 kg",
  curah: "Curah",
  liter: "Liter",
};

export const FAMILY_LABEL: Record<ProductFamilyId, string> = {
  kambing: "Kohe Kambing",
  sapi: "Kohe Sapi",
  ayam: "Kohe Ayam",
  poc: "POC",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  konsinyasi: "Konsinyasi",
};

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  masuk: "Masuk peternak",
  kirim: "Kirim antar gudang",
  jual: "Keluar penjualan",
  koreksi: "Koreksi stok",
};

export function packageUnitLabel(unit: PackageUnit) {
  return unit === "jerigen" ? "jerigen" : "sak";
}

export function warehouseKindLabel(kind: Warehouse["kind"]) {
  return kind === "gudang" ? "Gudang" : "Agen";
}

export function creditLabel(days: number) {
  if (days <= 0) return "Tunai / transfer";
  return `Tempo ${days} hari`;
}
