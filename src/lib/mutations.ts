import { PRODUCTS, snapshotLine } from "@/lib/catalog";
import { formatIdr } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import { nextOrderCode, outstandingOf } from "@/lib/order-math";
import { adjustStock, stockQty } from "@/lib/stock";
import type {
  AgentProfile,
  AppData,
  Movement,
  OrderDraft,
  Partner,
  PartnerDraft,
  PartnerType,
  ReceiptDraft,
  TransferDraft,
  VariantId,
} from "@/lib/types";
import { uid } from "@/lib/utils";

export type MutationResult =
  | { ok: true; id: string; notice: string; data: AppData }
  | { ok: false; message: string };

function warehouseName(data: AppData, warehouseId: string) {
  return data.warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? "gudang";
}

function assertPackageQty(qty: number) {
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) {
    return "Jumlah kemasan harus bilangan bulat antara 1 dan 9999.";
  }
  return null;
}

function shortageMessage(variant: VariantId, place: string, onHand: number) {
  const product = PRODUCTS.find((item) => item.id === variant);
  const unit = product ? packageUnitLabel(product.unit) : "kemasan";
  return `Stok ${product?.label ?? "produk"} di ${place} tinggal ${onHand} ${unit}.`;
}

const PARTNER_TYPES: PartnerType[] = ["toko_tani", "perkebunan", "urban"];

function normalizePartner(draft: PartnerDraft): { ok: true; value: Omit<Partner, "id"> } | { ok: false; message: string } {
  const name = draft.name.trim();
  const contactName = draft.contactName.trim();
  const address = draft.address.trim();
  const city = draft.city.trim();
  const region = draft.region.trim();
  const phone = draft.phone.trim();
  const digits = phone.replace(/\D/g, "");

  if (!PARTNER_TYPES.includes(draft.type)) return { ok: false, message: "Jenis mitra tidak dikenal." };
  if (name.length < 2) return { ok: false, message: "Isi nama usaha mitra." };
  if (contactName.length < 2) return { ok: false, message: "Isi nama kontak." };
  if (digits.length < 8 || digits.length > 15) return { ok: false, message: "Nomor telepon tidak valid." };
  if (city.length < 2) return { ok: false, message: "Isi kota." };
  if (region.length < 2) return { ok: false, message: "Isi wilayah." };
  if (address.length < 5) return { ok: false, message: "Isi alamat." };
  if (!Number.isInteger(draft.creditTermsDays) || draft.creditTermsDays < 0 || draft.creditTermsDays > 365) {
    return { ok: false, message: "Tenor harus bilangan hari antara 0 dan 365." };
  }
  if (!Number.isInteger(draft.creditLimitIdr) || draft.creditLimitIdr < 0) {
    return { ok: false, message: "Plafon tidak valid." };
  }
  if (draft.creditTermsDays > 0 && draft.creditLimitIdr <= 0) {
    return { ok: false, message: "Isi plafon konsinyasi untuk mitra bertempo." };
  }

  return {
    ok: true,
    value: {
      name,
      type: draft.type,
      contactName,
      phone,
      address,
      city,
      region,
      creditTermsDays: draft.creditTermsDays,
      creditLimitIdr: draft.creditTermsDays === 0 ? 0 : draft.creditLimitIdr,
    },
  };
}

export function applyOrder(data: AppData, draft: OrderDraft, now = new Date()): MutationResult {
  const partner = data.partners.find((item) => item.id === draft.partnerId);
  if (!partner) return { ok: false, message: "Pilih mitra terlebih dahulu." };

  const warehouse = data.warehouses.find((item) => item.id === draft.warehouseId);
  if (!warehouse) return { ok: false, message: "Pilih gudang asal." };

  if (draft.lines.some((line) => !Number.isInteger(line.qty) || line.qty < 0 || line.qty > 9999)) {
    return { ok: false, message: "Jumlah kemasan harus bilangan bulat maksimal 9999." };
  }

  const lines = draft.lines.filter((line) => line.qty > 0);
  if (lines.length === 0) return { ok: false, message: "Isi jumlah minimal satu varian." };
  if (lines.some((line) => !PRODUCTS.some((product) => product.id === line.variant))) {
    return { ok: false, message: "Varian produk tidak dikenal." };
  }

  const deliveryAddress = draft.deliveryAddress.trim();
  if (deliveryAddress.length < 5) return { ok: false, message: "Isi alamat pengiriman." };

  const snapshotted = lines.map((line) => snapshotLine(line.variant, line.qty));
  const incomingValue = snapshotted.reduce((sum, line) => sum + line.qty * line.unitPriceIdr, 0);

  if (draft.payment === "konsinyasi") {
    if (partner.creditTermsDays <= 0) {
      return { ok: false, message: "Mitra ini tidak punya tenor. Pilih tunai atau transfer." };
    }
    // New consignment plus open invoices must stay inside the credit limit.
    const room = partner.creditLimitIdr - outstandingOf(data.orders, partner.id);
    if (incomingValue > room) {
      return {
        ok: false,
        message: `Konsinyasi melebihi plafon. Sisa plafon ${formatIdr(Math.max(0, room))}.`,
      };
    }
  }

  for (const line of lines) {
    const onHand = stockQty(data.stock, draft.warehouseId, line.variant);
    if (line.qty > onHand) {
      return { ok: false, message: shortageMessage(line.variant, warehouse.name, onHand) };
    }
  }

  const createdAt = now.toISOString();
  const order = {
    id: uid("ord"),
    code: nextOrderCode(data.orders, now),
    partnerId: partner.id,
    warehouseId: warehouse.id,
    lines: snapshotted,
    deliveryAddress,
    payment: draft.payment,
    settled: draft.payment !== "konsinyasi",
    geo: draft.geo,
    note: draft.note.trim().slice(0, 280),
    createdAt,
  };

  // A sale removes packages from the shipping warehouse immediately.
  let stock = data.stock;
  const saleMovements: Movement[] = snapshotted.map((line) => {
    stock = adjustStock(stock, warehouse.id, line.variant, -line.qty);
    return {
      id: uid("mv"),
      kind: "jual",
      variant: line.variant,
      qty: line.qty,
      warehouseId: warehouse.id,
      orderId: order.id,
      partnerId: partner.id,
      note: order.code,
      createdAt,
    };
  });

  return {
    ok: true,
    id: order.id,
    notice: `Pesanan ${order.code} tersimpan.`,
    data: {
      ...data,
      orders: [order, ...data.orders],
      stock,
      movements: [...saleMovements, ...data.movements],
    },
  };
}

export function applyReceipt(data: AppData, draft: ReceiptDraft, now = new Date()): MutationResult {
  if (!data.warehouses.some((warehouse) => warehouse.id === draft.warehouseId)) {
    return { ok: false, message: "Pilih gudang tujuan." };
  }
  if (!PRODUCTS.some((product) => product.id === draft.variant)) {
    return { ok: false, message: "Pilih varian produk." };
  }
  const qtyError = assertPackageQty(draft.qty);
  if (qtyError) return { ok: false, message: qtyError };

  const breederName = draft.breederName.trim();
  if (breederName.length < 3) return { ok: false, message: "Isi sumber stok." };

  const createdAt = now.toISOString();
  const movement: Movement = {
    id: uid("mv"),
    kind: "masuk",
    variant: draft.variant,
    qty: draft.qty,
    warehouseId: draft.warehouseId,
    breederName,
    note: draft.note.trim().slice(0, 280),
    createdAt,
  };

  return {
    ok: true,
    id: movement.id,
    notice: "Stok masuk dicatat.",
    data: {
      ...data,
      stock: adjustStock(data.stock, draft.warehouseId, draft.variant, draft.qty),
      movements: [movement, ...data.movements],
    },
  };
}

export function applyTransfer(data: AppData, draft: TransferDraft, now = new Date()): MutationResult {
  if (draft.fromWarehouseId === draft.toWarehouseId) {
    return { ok: false, message: "Gudang asal dan tujuan harus berbeda." };
  }
  if (!data.warehouses.some((warehouse) => warehouse.id === draft.fromWarehouseId)) {
    return { ok: false, message: "Pilih gudang asal." };
  }
  if (!data.warehouses.some((warehouse) => warehouse.id === draft.toWarehouseId)) {
    return { ok: false, message: "Pilih gudang tujuan." };
  }
  if (!PRODUCTS.some((product) => product.id === draft.variant)) {
    return { ok: false, message: "Pilih varian produk." };
  }
  const qtyError = assertPackageQty(draft.qty);
  if (qtyError) return { ok: false, message: qtyError };

  const onHand = stockQty(data.stock, draft.fromWarehouseId, draft.variant);
  if (draft.qty > onHand) {
    return {
      ok: false,
      message: shortageMessage(draft.variant, warehouseName(data, draft.fromWarehouseId), onHand),
    };
  }

  // A transfer keeps total company stock unchanged and only moves location.
  let stock = adjustStock(data.stock, draft.fromWarehouseId, draft.variant, -draft.qty);
  stock = adjustStock(stock, draft.toWarehouseId, draft.variant, draft.qty);

  const movement: Movement = {
    id: uid("mv"),
    kind: "kirim",
    variant: draft.variant,
    qty: draft.qty,
    warehouseId: draft.fromWarehouseId,
    toWarehouseId: draft.toWarehouseId,
    note: draft.note.trim().slice(0, 280),
    createdAt: now.toISOString(),
  };

  return {
    ok: true,
    id: movement.id,
    notice: "Kiriman antar gudang dicatat.",
    data: {
      ...data,
      stock,
      movements: [movement, ...data.movements],
    },
  };
}

export function applyPartner(data: AppData, draft: PartnerDraft): MutationResult {
  const normalized = normalizePartner(draft);
  if (!normalized.ok) return normalized;
  const partner = { id: uid("p"), ...normalized.value };
  return {
    ok: true,
    id: partner.id,
    notice: `${partner.name} ditambahkan.`,
    data: { ...data, partners: [partner, ...data.partners] },
  };
}

export function applyUpdatePartner(data: AppData, partnerId: string, draft: PartnerDraft): MutationResult {
  if (!data.partners.some((item) => item.id === partnerId)) {
    return { ok: false, message: "Mitra tidak ditemukan." };
  }
  const normalized = normalizePartner(draft);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    id: partnerId,
    notice: `${normalized.value.name} diperbarui.`,
    data: {
      ...data,
      partners: data.partners.map((item) => (item.id === partnerId ? { id: partnerId, ...normalized.value } : item)),
    },
  };
}

export function applyRemovePartner(data: AppData, partnerId: string): MutationResult {
  const partner = data.partners.find((item) => item.id === partnerId);
  if (!partner) return { ok: false, message: "Mitra tidak ditemukan." };
  if (data.orders.some((order) => order.partnerId === partner.id)) {
    return { ok: false, message: "Mitra ini masih punya pesanan." };
  }
  return {
    ok: true,
    id: partner.id,
    notice: `${partner.name} dihapus.`,
    data: { ...data, partners: data.partners.filter((item) => item.id !== partner.id) },
  };
}

export function applyProfile(data: AppData, draft: AgentProfile): MutationResult {
  const name = draft.name.trim();
  const role = draft.role.trim();
  const territory = draft.territory.trim();
  const phone = draft.phone.trim();
  const digits = phone.replace(/\D/g, "");

  if (name.length < 2) return { ok: false, message: "Isi nama agen." };
  if (role.length < 2) return { ok: false, message: "Isi peran." };
  if (territory.length < 2) return { ok: false, message: "Isi wilayah kerja." };
  if (digits.length < 8 || digits.length > 15) return { ok: false, message: "Nomor telepon tidak valid." };

  return {
    ok: true,
    id: "profile",
    notice: "Profil tersimpan.",
    data: {
      ...data,
      profile: { name, phone, role, territory },
    },
  };
}

export function applySettle(data: AppData, orderId: string): MutationResult {
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return { ok: false, message: "Pesanan tidak ditemukan." };
  if (order.payment !== "konsinyasi") {
    return { ok: false, message: "Pesanan tunai atau transfer sudah tertagih." };
  }
  if (order.settled) return { ok: false, message: "Pesanan sudah lunas." };

  // Settlement does not move stock. The sacks left the warehouse when the order was saved.
  return {
    ok: true,
    id: order.id,
    notice: `Pesanan ${order.code} ditandai lunas.`,
    data: {
      ...data,
      orders: data.orders.map((item) => (item.id === order.id ? { ...item, settled: true } : item)),
    },
  };
}

export function applyCancelOrder(data: AppData, orderId: string): MutationResult {
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) return { ok: false, message: "Pesanan tidak ditemukan." };
  let stock = data.stock;
  for (const line of order.lines) {
    stock = adjustStock(stock, order.warehouseId, line.variant, line.qty);
  }
  return {
    ok: true,
    id: order.id,
    notice: `Pesanan ${order.code} dibatalkan. Stok dikembalikan.`,
    data: {
      ...data,
      orders: data.orders.filter((item) => item.id !== order.id),
      stock,
      movements: data.movements.filter((item) => item.orderId !== order.id),
    },
  };
}

export function applyWriteOff(
  data: AppData,
  draft: { warehouseId: string; variant: VariantId; qty: number },
  now = new Date(),
): MutationResult {
  if (!data.warehouses.some((warehouse) => warehouse.id === draft.warehouseId)) {
    return { ok: false, message: "Pilih gudang." };
  }
  if (!PRODUCTS.some((product) => product.id === draft.variant)) {
    return { ok: false, message: "Pilih varian produk." };
  }
  const qtyError = assertPackageQty(draft.qty);
  if (qtyError) return { ok: false, message: qtyError };
  const onHand = stockQty(data.stock, draft.warehouseId, draft.variant);
  if (draft.qty > onHand) {
    return { ok: false, message: shortageMessage(draft.variant, warehouseName(data, draft.warehouseId), onHand) };
  }
  const movement: Movement = {
    id: uid("mv"),
    kind: "koreksi",
    variant: draft.variant,
    qty: draft.qty,
    warehouseId: draft.warehouseId,
    note: "Hapus stok",
    createdAt: now.toISOString(),
  };
  return {
    ok: true,
    id: movement.id,
    notice: "Stok dihapus dari gudang.",
    data: {
      ...data,
      stock: adjustStock(data.stock, draft.warehouseId, draft.variant, -draft.qty),
      movements: [movement, ...data.movements],
    },
  };
}
