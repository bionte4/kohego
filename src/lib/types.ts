export type ProductFamilyId = "kambing" | "sapi" | "ayam" | "poc";

/** Catalog id. Seed SKUs keep their historical ids. New variants get a generated id. */
export type VariantId = string;

export const PACKAGE_SIZES = ["5kg", "10kg", "25kg", "curah", "liter"] as const;

export type PackageSize = (typeof PACKAGE_SIZES)[number];

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
  packageSize: PackageSize;
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
  /** Field pin for the shop. Null until someone records coordinates. */
  geo: GeoTag | null;
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
  /** Street or village used as the origin location. */
  location: string;
  /** Maximum on-hand packages across every variant. */
  capacity: number;
  /** Person in charge of the site. */
  pic: string;
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
  version: 3;
  partners: Partner[];
  orders: Order[];
  warehouses: Warehouse[];
  /** Live packaging catalog. Orders keep the price and weight copied onto each line. */
  products: Product[];
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
  geo: GeoTag | null;
}

export interface WarehouseDraft {
  name: string;
  location: string;
  capacity: number;
  pic: string;
  kind: "gudang" | "agen";
}

export interface ProductDraft {
  label: string;
  family: ProductFamilyId;
  packageSize: PackageSize;
  priceIdr: number;
  /** Used when packageSize is liter. Ignored for dry sacks. */
  volumeL: number;
}

export interface OpnameDraft {
  warehouseId: string;
  variant: VariantId;
  /** Counted packages. The ledger stores the difference from on-hand. */
  countedQty: number;
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string };
