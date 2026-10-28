import { FAMILIES, lowStockLimit, PRODUCTS, productsByFamily } from "@/lib/catalog";
import {
  daysPastDue,
  isCollected,
  isOverdue,
  orderKilograms,
  orderLiters,
  orderRevenue,
} from "@/lib/order-math";
import type { AppData, Order, PartnerType, ProductFamilyId, VariantId } from "@/lib/types";

export interface WeekBucket {
  key: string;
  label: string;
  dayLabel: string;
  revenue: number;
  kilograms: number;
  orders: number;
}

export interface MixSlice {
  family: ProductFamilyId;
  label: string;
  revenue: number;
  kilograms: number;
  liters: number;
  share: number;
  color: string;
}

export interface PartnerRank {
  partnerId: string;
  name: string;
  type: PartnerType;
  revenue: number;
  orders: number;
}

export interface OverdueItem {
  orderId: string;
  code: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  daysPastDue: number;
}

export interface LowStockItem {
  warehouseId: string;
  warehouseName: string;
  variant: VariantId;
  qty: number;
}

export interface DashboardMetrics {
  revenue30: number;
  revenueDelta: number | null;
  tonnageKg30: number;
  activePartners: number;
  totalPartners: number;
  collectionRate: number;
  liters30: number;
  outstanding: number;
  averageOrderValue: number;
  repeatRate: number;
  orders30: number;
  weeks: WeekBucket[];
  mix: MixSlice[];
  topPartners: PartnerRank[];
  recentOrders: Order[];
  overdue: OverdueItem[];
  lowStock: LowStockItem[];
}

const MIX_COLORS: Record<ProductFamilyId, string> = {
  kambing: "#166534",
  sapi: "#78350f",
  ayam: "#4d7c0f",
  poc: "#0f766e",
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date);
  const weekday = copy.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + mondayOffset);
  return copy;
}

function sumRevenue(orders: Order[]) {
  return orders.reduce((sum, order) => sum + orderRevenue(order), 0);
}

function sumKilograms(orders: Order[]) {
  return orders.reduce((sum, order) => sum + orderKilograms(order), 0);
}

function sumLiters(orders: Order[]) {
  return orders.reduce((sum, order) => sum + orderLiters(order), 0);
}

export function buildDashboard(
  data: Pick<AppData, "partners" | "orders" | "warehouses" | "stock">,
  now = new Date(),
): DashboardMetrics {
  const orders = [...data.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Trailing window is 30 local calendar days, including today.
  // The comparison window is the 30 calendar days immediately before it.
  const currentStart = addDays(startOfDay(now), -29).getTime();
  const previousStart = addDays(startOfDay(now), -59).getTime();
  const nowMs = now.getTime();

  const inCurrent = orders.filter((order) => {
    const time = new Date(order.createdAt).getTime();
    return time >= currentStart && time <= nowMs;
  });
  const inPrevious = orders.filter((order) => {
    const time = new Date(order.createdAt).getTime();
    return time >= previousStart && time < currentStart;
  });

  const revenue30 = sumRevenue(inCurrent);
  const previousRevenue = sumRevenue(inPrevious);
  const revenueDelta =
    previousRevenue === 0 ? null : (revenue30 - previousRevenue) / previousRevenue;

  const booked = sumRevenue(orders);
  const collected = orders.reduce(
    (sum, order) => sum + (isCollected(order) ? orderRevenue(order) : 0),
    0,
  );

  const activePartners = new Set(inCurrent.map((order) => order.partnerId)).size;

  const buyerCounts = new Map<string, number>();
  for (const order of orders) {
    buyerCounts.set(order.partnerId, (buyerCounts.get(order.partnerId) ?? 0) + 1);
  }
  const buyers = buyerCounts.size;
  const repeatBuyers = [...buyerCounts.values()].filter((count) => count >= 2).length;

  const thisWeek = startOfWeek(now);
  const weeks: WeekBucket[] = [];
  for (let index = 7; index >= 0; index -= 1) {
    const start = addDays(thisWeek, -7 * index);
    const end = addDays(start, 7);
    const inWeek = orders.filter((order) => {
      const time = new Date(order.createdAt).getTime();
      return time >= start.getTime() && time < end.getTime();
    });
    weeks.push({
      key: start.toISOString(),
      label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(start),
      dayLabel: new Intl.DateTimeFormat("id-ID", { day: "numeric" }).format(start),
      revenue: sumRevenue(inWeek),
      kilograms: sumKilograms(inWeek),
      orders: inWeek.length,
    });
  }

  const mixTotals = FAMILIES.map((family) => {
    const ids = new Set(productsByFamily(family.id).map((product) => product.id));
    const lines = orders.flatMap((order) => order.lines.filter((line) => ids.has(line.variant)));
    const revenue = lines.reduce((sum, line) => sum + line.qty * line.unitPriceIdr, 0);
    const kilograms = lines.reduce((sum, line) => sum + line.qty * line.weightKg, 0);
    const liters = lines.reduce((sum, line) => sum + line.qty * (line.volumeL ?? 0), 0);
    return { family, revenue, kilograms, liters };
  });
  const mixRevenue = mixTotals.reduce((sum, item) => sum + item.revenue, 0);
  const mix: MixSlice[] = mixTotals.map((item) => ({
    family: item.family.id,
    label: item.family.label,
    revenue: item.revenue,
    kilograms: item.kilograms,
    liters: item.liters,
    share: mixRevenue === 0 ? 0 : item.revenue / mixRevenue,
    color: MIX_COLORS[item.family.id],
  }));

  const topPartners: PartnerRank[] = data.partners
    .map((partner) => {
      const related = orders.filter((order) => order.partnerId === partner.id);
      return {
        partnerId: partner.id,
        name: partner.name,
        type: partner.type,
        revenue: sumRevenue(related),
        orders: related.length,
      };
    })
    .filter((partner) => partner.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const overdue = orders
    .flatMap((order) => {
      const partner = data.partners.find((item) => item.id === order.partnerId);
      if (!partner || !isOverdue(order, partner, now)) return [];
      return [
        {
          orderId: order.id,
          code: order.code,
          partnerId: partner.id,
          partnerName: partner.name,
          amount: orderRevenue(order),
          daysPastDue: daysPastDue(order, partner, now),
        },
      ];
    })
    .sort((a, b) => b.daysPastDue - a.daysPastDue);

  const lowStock: LowStockItem[] = data.stock
    .filter((line) => {
      const product = PRODUCTS.find((item) => item.id === line.variant);
      return product ? line.qty < lowStockLimit(product) : false;
    })
    .map((line) => ({
      warehouseId: line.warehouseId,
      warehouseName:
        data.warehouses.find((warehouse) => warehouse.id === line.warehouseId)?.name ?? "Gudang",
      variant: line.variant,
      qty: line.qty,
    }))
    .sort((a, b) => a.qty - b.qty);

  return {
    revenue30,
    revenueDelta,
    tonnageKg30: sumKilograms(inCurrent),
    liters30: sumLiters(inCurrent),
    activePartners,
    totalPartners: data.partners.length,
    collectionRate: booked === 0 ? 0 : collected / booked,
    outstanding: booked - collected,
    averageOrderValue: inCurrent.length === 0 ? 0 : revenue30 / inCurrent.length,
    repeatRate: buyers === 0 ? 0 : repeatBuyers / buyers,
    orders30: inCurrent.length,
    weeks,
    mix,
    topPartners,
    recentOrders: orders.slice(0, 6),
    overdue,
    lowStock,
  };
}
