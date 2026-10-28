import type { Order, Partner } from "@/lib/types";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Booked value uses the price stored on each line, not today's list price. */
export function orderRevenue(order: Order) {
  return order.lines.reduce((sum, line) => sum + line.qty * line.unitPriceIdr, 0);
}

/** Sold mass in kilograms. Liquid lines contribute zero so tonnage stays solid. */
export function orderKilograms(order: Order) {
  return order.lines.reduce((sum, line) => sum + line.qty * line.weightKg, 0);
}

/** Sold liquid volume. Dry lines contribute zero. */
export function orderLiters(order: Order) {
  return order.lines.reduce((sum, line) => sum + line.qty * (line.volumeL ?? 0), 0);
}

/**
 * Cash and transfer are collected when the order is saved.
 * Consignment stays outstanding until someone marks it lunas.
 */
export function isCollected(order: Order) {
  if (order.payment === "konsinyasi") return order.settled;
  return true;
}

/** Unpaid consignment counts against the partner credit limit. */
export function outstandingOf(orders: Order[], partnerId: string) {
  return orders.reduce((sum, order) => {
    if (order.partnerId !== partnerId || isCollected(order)) return sum;
    return sum + orderRevenue(order);
  }, 0);
}

/**
 * Tenor is an exact number of 24-hour days from the order timestamp.
 * A 30-day term due on the 30th day is not rounded to a calendar month.
 */
export function dueTimestamp(order: Order, partner: Partner) {
  return new Date(order.createdAt).getTime() + partner.creditTermsDays * MS_DAY;
}

export function isOverdue(order: Order, partner: Partner, now: Date) {
  if (order.payment !== "konsinyasi" || order.settled) return false;
  return now.getTime() > dueTimestamp(order, partner);
}

export function daysPastDue(order: Order, partner: Partner, now: Date) {
  const overdueMs = now.getTime() - dueTimestamp(order, partner);
  return Math.max(1, Math.floor(overdueMs / MS_DAY));
}

export function nextOrderCode(orders: Order[], now: Date) {
  const year = String(now.getFullYear()).slice(2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const prefix = `KH-${year}${month}${day}`;
  const sequence = orders.filter((order) => order.code.startsWith(prefix)).length + 1;
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

export function partnerStats(partnerId: string, orders: Order[]) {
  const related = orders
    .filter((order) => order.partnerId === partnerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    orders: related.length,
    revenue: related.reduce((sum, order) => sum + orderRevenue(order), 0),
    outstanding: related.reduce(
      (sum, order) => sum + (isCollected(order) ? 0 : orderRevenue(order)),
      0,
    ),
    kilograms: related.reduce((sum, order) => sum + orderKilograms(order), 0),
    lastAt: related[0]?.createdAt ?? null,
  };
}

export function describeSettlement(order: Order, partner: Partner | undefined, now: Date) {
  if (isCollected(order)) {
    return {
      label: order.payment === "konsinyasi" ? "Lunas" : "Tertagih",
      tone: "forest" as const,
      overdue: false,
    };
  }
  if (partner && isOverdue(order, partner, now)) {
    return { label: "Jatuh tempo", tone: "red" as const, overdue: true };
  }
  return { label: "Belum lunas", tone: "amber" as const, overdue: false };
}
