import { PRODUCTS, productById, snapshotLine } from "@/lib/catalog";
import { nextOrderCode } from "@/lib/order-math";
import type {
  AppData,
  Movement,
  Order,
  OrderLine,
  Partner,
  PaymentMethod,
  VariantId,
  Warehouse,
} from "@/lib/types";

/**
 * Sample book for a multi-product organic fertilizer distributor.
 * On-hand stock is a current snapshot. Historical orders are not replayed
 * onto that snapshot. Movement rows are a recent activity log only.
 */
const partners: Omit<Partner, "geo">[] = [
  {
    id: "p-subur",
    name: "Toko Tani Subur Makmur",
    type: "toko_tani",
    contactName: "Sari Dewi",
    phone: "0812-2204-1187",
    address: "Jl. Raya Lembang No. 48",
    city: "Lembang",
    region: "Jawa Barat",
    creditTermsDays: 14,
    creditLimitIdr: 8_000_000,
  },
  {
    id: "p-harapan",
    name: "Toko Tani Harapan Tani",
    type: "toko_tani",
    contactName: "Asep Rohman",
    phone: "0813-7781-4410",
    address: "Jl. Ahmad Yani No. 112",
    city: "Garut",
    region: "Jawa Barat",
    creditTermsDays: 0,
    creditLimitIdr: 0,
  },
  {
    id: "p-mekar",
    name: "Perkebunan Mekar Sari",
    type: "perkebunan",
    contactName: "Ujang Suryana",
    phone: "0821-5560-9022",
    address: "Kp. Cibodas, Desa Sukamanah",
    city: "Cianjur",
    region: "Jawa Barat",
    creditTermsDays: 30,
    creditLimitIdr: 20_000_000,
  },
  {
    id: "p-rejeki",
    name: "Perkebunan Sumber Rejeki",
    type: "perkebunan",
    contactName: "Wagiman",
    phone: "0852-4419-3308",
    address: "Dusun Senden, Desa Suroteleng",
    city: "Boyolali",
    region: "Jawa Tengah",
    creditTermsDays: 21,
    creditLimitIdr: 12_000_000,
  },
  {
    id: "p-agro",
    name: "Toko Tani Agro Jaya",
    type: "toko_tani",
    contactName: "Retno Wulandari",
    phone: "0811-9088-2271",
    address: "Jl. Kaliurang Km 8",
    city: "Sleman",
    region: "DI Yogyakarta",
    creditTermsDays: 7,
    creditLimitIdr: 6_000_000,
  },
  {
    id: "p-sawah",
    name: "Urban Farm Sawah Lestari",
    type: "urban",
    contactName: "Dimas Pratama",
    phone: "0878-3340-6615",
    address: "Jl. Dago Giri No. 21",
    city: "Bandung",
    region: "Jawa Barat",
    creditTermsDays: 7,
    creditLimitIdr: 4_000_000,
  },
  {
    id: "p-mitra",
    name: "Toko Tani Mitra Tani",
    type: "toko_tani",
    contactName: "Sri Hartati",
    phone: "0813-6627-1544",
    address: "Jl. Pemuda No. 9",
    city: "Magelang",
    region: "Jawa Tengah",
    creditTermsDays: 0,
    creditLimitIdr: 0,
  },
  {
    id: "p-horti",
    name: "Perkebunan Horti Nusantara",
    type: "perkebunan",
    contactName: "Linda Kusuma",
    phone: "0822-1904-7783",
    address: "Jl. Soekarno-Hatta No. 540",
    city: "Bandung",
    region: "Jawa Barat",
    creditTermsDays: 7,
    creditLimitIdr: 30_000_000,
  },
  {
    id: "p-kota",
    name: "Kebun Kota Hijau Atap",
    type: "urban",
    contactName: "Nadia Putri",
    phone: "0818-2209-4411",
    address: "Jl. Ciumbuleuit No. 18",
    city: "Bandung",
    region: "Jawa Barat",
    creditTermsDays: 0,
    creditLimitIdr: 0,
  },
];

const warehouses: Warehouse[] = [
  {
    id: "w-pusat",
    name: "Gudang Pusat Lembang",
    city: "Lembang",
    kind: "gudang",
    location: "Jl. Raya Lembang No. 88",
    capacity: 2500,
    pic: "Bambang Wijaya",
  },
  {
    id: "w-garut",
    name: "Agen Garut",
    city: "Garut",
    kind: "agen",
    location: "Kp. Cikajang, Garut",
    capacity: 800,
    pic: "Dewi Lestari",
  },
  {
    id: "w-boyolali",
    name: "Agen Boyolali",
    city: "Boyolali",
    kind: "agen",
    location: "Jl. Merapi, Boyolali",
    capacity: 800,
    pic: "Agus Salim",
  },
];

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function atDay(now: Date, daysAgo: number, hour: number, minute: number) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function warehouseIdFor(partner: Omit<Partner, "geo">) {
  if (partner.region === "Jawa Tengah" || partner.region === "DI Yogyakarta") return "w-boyolali";
  if (partner.city === "Garut") return "w-garut";
  return "w-pusat";
}

function paymentFor(partner: Omit<Partner, "geo">, rand: () => number): PaymentMethod {
  if (partner.creditTermsDays <= 0) return rand() > 0.35 ? "tunai" : "transfer";
  const roll = rand();
  if (roll < 0.4) return "tunai";
  if (roll < 0.72) return "transfer";
  return "konsinyasi";
}

const ASSORTMENT: Record<Partner["type"], VariantId[]> = {
  toko_tani: ["kambing-5", "kambing-10", "ayam-5", "ayam-10", "poc-1"],
  poktan: ["kambing-25", "sapi-25", "ayam-10", "poc-5"],
  perkebunan: ["kambing-25", "sapi-25", "sapi-10", "ayam-10", "poc-5"],
  urban: ["poc-1", "poc-5", "kambing-5", "ayam-5"],
};

function qtyFor(variant: VariantId, rand: () => number) {
  const product = productById(variant);
  if (product.weightKg >= 25) return 2 + Math.floor(rand() * 10);
  if (product.volumeL >= 5) return 1 + Math.floor(rand() * 3);
  if (product.unit === "jerigen") return 1 + Math.floor(rand() * 6);
  return 1 + Math.floor(rand() * 8);
}

function buildLines(partner: Omit<Partner, "geo">, rand: () => number): OrderLine[] {
  const pool = ASSORTMENT[partner.type];
  const first = pool[Math.floor(rand() * pool.length)] ?? "kambing-10";
  const lines = [snapshotLine(first, qtyFor(first, rand))];
  if (rand() > 0.55) {
    const rest = pool.filter((id) => id !== first);
    const second = rest[Math.floor(rand() * rest.length)];
    if (second) lines.push(snapshotLine(second, Math.max(1, Math.round(qtyFor(second, rand) / 2))));
  }
  return lines;
}

function pushOrder(
  orders: Order[],
  partner: Omit<Partner, "geo">,
  createdAt: Date,
  payment: PaymentMethod,
  settled: boolean,
  lines: OrderLine[],
  note = "",
) {
  orders.push({
    id: `ord-${String(orders.length + 1).padStart(4, "0")}`,
    code: nextOrderCode(orders, createdAt),
    partnerId: partner.id,
    warehouseId: warehouseIdFor(partner),
    lines,
    deliveryAddress: `${partner.address}, ${partner.city}`,
    payment,
    settled,
    geo: null,
    note,
    createdAt: createdAt.toISOString(),
  });
}

export function createSeed(now = new Date()): AppData {
  const rand = mulberry32(20261028);
  const orders: Order[] = [];

  for (let daysAgo = 56; daysAgo >= 1; daysAgo -= 1) {
    const roll = rand();
    const count = roll > 0.84 ? 2 : roll > 0.42 ? 1 : 0;
    for (let index = 0; index < count; index += 1) {
      const partner = partners[Math.floor(rand() * partners.length)];
      if (!partner) continue;
      const payment = paymentFor(partner, rand);
      let settled = payment !== "konsinyasi";
      if (payment === "konsinyasi") {
        settled = daysAgo > partner.creditTermsDays ? rand() > 0.4 : false;
      }
      pushOrder(
        orders,
        partner,
        atDay(now, daysAgo, 7 + Math.floor(rand() * 10), Math.floor(rand() * 60)),
        payment,
        settled,
        buildLines(partner, rand),
      );
    }
  }

  const mekar = partners.find((partner) => partner.id === "p-mekar");
  const subur = partners.find((partner) => partner.id === "p-subur");
  const agro = partners.find((partner) => partner.id === "p-agro");

  if (mekar) {
    pushOrder(
      orders,
      mekar,
      atDay(now, 50, 9, 15),
      "konsinyasi",
      false,
      [snapshotLine("kambing-25", 16)],
      "Karung musim tanam, jatuh tempo belum ditagih.",
    );
  }
  if (subur) {
    pushOrder(
      orders,
      subur,
      atDay(now, 2, 10, 40),
      "konsinyasi",
      false,
      [snapshotLine("kambing-10", 8)],
      "Konsinyasi masih dalam tenor.",
    );
  }
  if (agro) {
    const today = new Date(now.getTime() - 45 * 60 * 1000);
    const stamp = today.getDate() === now.getDate() ? today : now;
    pushOrder(orders, agro, stamp, "tunai", true, [snapshotLine("kambing-5", 4), snapshotLine("poc-1", 2)]);
  }

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const movements: Movement[] = [
    {
      id: "mv-masuk-25",
      kind: "masuk",
      variant: "kambing-25",
      qty: 180,
      warehouseId: "w-pusat",
      breederName: "Pak Dedi, Peternak Kambing Cikole",
      note: "Fermentasi batch 41.",
      createdAt: atDay(now, 1, 9, 5).toISOString(),
    },
    {
      id: "mv-masuk-10",
      kind: "masuk",
      variant: "sapi-25",
      qty: 60,
      warehouseId: "w-boyolali",
      breederName: "Bu Minah, Peternak Sapi Kopeng",
      note: "Soil conditioner, sudah diayak.",
      createdAt: atDay(now, 3, 11, 20).toISOString(),
    },
    {
      id: "mv-masuk-5",
      kind: "masuk",
      variant: "ayam-10",
      qty: 90,
      warehouseId: "w-pusat",
      breederName: "Pak Wahyu, Peternak Ayam Pangalengan",
      note: "Nitrogen booster, kemasan 10 kg.",
      createdAt: atDay(now, 6, 8, 45).toISOString(),
    },
    {
      id: "mv-kirim-garut",
      kind: "kirim",
      variant: "kambing-25",
      qty: 40,
      warehouseId: "w-pusat",
      toWarehouseId: "w-garut",
      note: "Isi ulang agen.",
      createdAt: atDay(now, 2, 14, 10).toISOString(),
    },
    {
      id: "mv-kirim-boyolali",
      kind: "kirim",
      variant: "poc-1",
      qty: 24,
      warehouseId: "w-pusat",
      toWarehouseId: "w-boyolali",
      note: "Jerigen POC untuk toko dan kebun kota.",
      createdAt: atDay(now, 4, 13, 0).toISOString(),
    },
  ];

  for (const order of orders.slice(0, 5)) {
    for (const line of order.lines) {
      movements.push({
        id: `mv-${order.id}-${line.variant}`,
        kind: "jual",
        variant: line.variant,
        qty: line.qty,
        warehouseId: order.warehouseId,
        orderId: order.id,
        partnerId: order.partnerId,
        note: order.code,
        createdAt: order.createdAt,
      });
    }
  }

  movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    version: 3,
    profile: {
      name: "Rina Kartika",
      phone: "0812-4401-7788",
      role: "Agen penjualan lapangan",
      territory: "Jawa Barat & Jawa Tengah",
    },
    partners: partners.map((partner) => ({ ...partner, geo: null })),
    warehouses: warehouses.map((warehouse) => ({ ...warehouse })),
    products: PRODUCTS.map((product) => ({ ...product })),
    orders,
    movements,
    stock: [
      { warehouseId: "w-pusat", variant: "kambing-5", qty: 240 },
      { warehouseId: "w-pusat", variant: "kambing-10", qty: 160 },
      { warehouseId: "w-pusat", variant: "kambing-25", qty: 310 },
      { warehouseId: "w-pusat", variant: "sapi-10", qty: 90 },
      { warehouseId: "w-pusat", variant: "sapi-25", qty: 140 },
      { warehouseId: "w-pusat", variant: "ayam-5", qty: 70 },
      { warehouseId: "w-pusat", variant: "ayam-10", qty: 110 },
      { warehouseId: "w-pusat", variant: "poc-1", qty: 48 },
      { warehouseId: "w-pusat", variant: "poc-5", qty: 24 },
      { warehouseId: "w-garut", variant: "kambing-5", qty: 36 },
      { warehouseId: "w-garut", variant: "kambing-10", qty: 22 },
      { warehouseId: "w-garut", variant: "kambing-25", qty: 12 },
      { warehouseId: "w-garut", variant: "sapi-10", qty: 28 },
      { warehouseId: "w-garut", variant: "sapi-25", qty: 40 },
      { warehouseId: "w-garut", variant: "ayam-5", qty: 24 },
      { warehouseId: "w-garut", variant: "ayam-10", qty: 32 },
      { warehouseId: "w-garut", variant: "poc-1", qty: 6 },
      { warehouseId: "w-garut", variant: "poc-5", qty: 10 },
      { warehouseId: "w-boyolali", variant: "kambing-5", qty: 8 },
      { warehouseId: "w-boyolali", variant: "kambing-10", qty: 48 },
      { warehouseId: "w-boyolali", variant: "kambing-25", qty: 64 },
      { warehouseId: "w-boyolali", variant: "sapi-10", qty: 30 },
      { warehouseId: "w-boyolali", variant: "sapi-25", qty: 44 },
      { warehouseId: "w-boyolali", variant: "ayam-5", qty: 18 },
      { warehouseId: "w-boyolali", variant: "ayam-10", qty: 26 },
      { warehouseId: "w-boyolali", variant: "poc-1", qty: 20 },
      { warehouseId: "w-boyolali", variant: "poc-5", qty: 12 },
    ],
  };
}
