export type ProductFamilyId = "kambing" | "sapi" | "ayam" | "poc";

export type VariantId =
  | "kambing-5"
  | "kambing-10"
  | "kambing-25"
  | "sapi-10"
  | "sapi-25"
  | "ayam-5"
  | "ayam-10"
  | "poc-1"
  | "poc-5";

export type PackageUnit = "sak" | "jerigen";

export interface Product {
  id: VariantId;
  family: ProductFamilyId;
  label: string;
  shortLabel: string;
  /** Shelf role, such as Ritel, Curah, Soil conditioner, or Nitrogen booster. */
  role: string;
  /** Mass of one package. Liquid SKUs stay at zero so tonnage counts solids only. */
  weightKg: number;
  /** Volume of one package. Dry goods stay at zero. */
  volumeL: number;
  unit: PackageUnit;
  /** Current list price. Orders snapshot this so later price edits do not rewrite history. */
  priceIdr: number;
  sku: string;
}

export type PartnerType = "toko_tani" | "perkebunan" | "urban";

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  contactName: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  /** Days before unpaid consignment is overdue. Zero means cash or transfer only. */
  creditTermsDays: number;
  /** Maximum unpaid consignment in rupiah. Ignored when tenor is zero. */
  creditLimitIdr: number;
}

export type PaymentMethod = "tunai" | "transfer" | "konsinyasi";

export interface OrderLine {
  variant: VariantId;
  qty: number;
  unitPriceIdr: number;
  weightKg: number;
  volumeL: number;
}

export interface GeoTag {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

export interface Order {
  id: string;
  code: string;
  partnerId: string;
  warehouseId: string;
  lines: OrderLine[];
  deliveryAddress: string;
  payment: PaymentMethod;
  /** False only while a consignment invoice is still open. */
  settled: boolean;
  geo: GeoTag | null;
  note: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  kind: "gudang" | "agen";
}

export interface StockLine {
  warehouseId: string;
  variant: VariantId;
  /** On-hand packages (sak or jerigen), not kilograms or liters. */
  qty: number;
}

export type MovementKind = "masuk" | "kirim" | "jual" | "koreksi";

export interface Movement {
  id: string;
  kind: MovementKind;
  variant: VariantId;
  qty: number;
  warehouseId: string;
  toWarehouseId?: string;
  orderId?: string;
  partnerId?: string;
  breederName?: string;
  note?: string;
  createdAt: string;
}

export interface AgentProfile {
  name: string;
  phone: string;
  role: string;
  territory: string;
}

export interface AppData {
  version: 2;
  partners: Partner[];
  orders: Order[];
  warehouses: Warehouse[];
  stock: StockLine[];
  movements: Movement[];
  profile: AgentProfile;
}

export interface OrderDraft {
  partnerId: string;
  warehouseId: string;
  lines: { variant: VariantId; qty: number }[];
  deliveryAddress: string;
  payment: PaymentMethod;
  geo: GeoTag | null;
  note: string;
}

export interface ReceiptDraft {
  warehouseId: string;
  variant: VariantId;
  qty: number;
  breederName: string;
  note: string;
}

export interface TransferDraft {
  fromWarehouseId: string;
  toWarehouseId: string;
  variant: VariantId;
  qty: number;
  note: string;
}

export interface PartnerDraft {
  name: string;
  type: PartnerType;
  contactName: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  creditTermsDays: number;
  creditLimitIdr: number;
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string };
