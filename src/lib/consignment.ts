import { dueTimestamp, isCollected, orderKilograms, orderRevenue } from "@/lib/order-math";
import { periodOf } from "@/lib/payroll";
import type { FieldVisit, Order, Partner } from "@/lib/types";

export interface VolumeTier {
  label: string;
  rate: number;
}

export interface ConsignmentRow {
  orderId: string;
  code: string;
  partnerId: string;
  partnerName: string;
  openIdr: number;
  dueOn: string;
  overdue: boolean;
  volumeKg: number;
  tier: VolumeTier;
  suggestedCreditIdr: number;
}

/**
 * Monthly solid tonnage sets the discount tier. The credit is a suggestion
 * on the open consignment balance. Saved invoice prices stay as booked.
 */
export function volumeTier(kilograms: number): VolumeTier {
  if (kilograms >= 800) return { label: "Tingkat 3", rate: 0.04 };
  if (kilograms >= 200) return { label: "Tingkat 2", rate: 0.02 };
  return { label: "Tingkat 1", rate: 0 };
}

export function buildConsignmentLedger(orders: Order[], partners: Partner[], period: string, now: Date): ConsignmentRow[] {
  const volume = new Map<string, number>();
  for (const order of orders) {
    if (periodOf(order.createdAt) !== period) continue;
    volume.set(order.partnerId, (volume.get(order.partnerId) ?? 0) + orderKilograms(order));
  }
  return orders.flatMap((order) => {
    if (order.payment !== "konsinyasi" || isCollected(order)) return [];
    const partner = partners.find((item) => item.id === order.partnerId);
    if (!partner) return [];
    const due = new Date(dueTimestamp(order, partner));
    const tier = volumeTier(volume.get(order.partnerId) ?? 0);
    const openIdr = orderRevenue(order);
    return [
      {
        orderId: order.id,
        code: order.code,
        partnerId: partner.id,
        partnerName: partner.name,
        openIdr,
        dueOn: due.toISOString().slice(0, 10),
        overdue: now.getTime() > due.getTime(),
        volumeKg: Math.round((volume.get(order.partnerId) ?? 0) * 10) / 10,
        tier,
        suggestedCreditIdr: Math.round(openIdr * tier.rate),
      },
    ];
  });
}

export function parseVisits(input: unknown): FieldVisit[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<FieldVisit>;
    if (typeof row.id !== "string" || typeof row.partnerId !== "string" || typeof row.visitedAt !== "string") return [];
    const geo = row.geo;
    const point = geo && typeof geo.lat === "number" && typeof geo.lng === "number" ? { lat: geo.lat, lng: geo.lng, accuracyM: geo.accuracyM ?? null } : null;
    return [
      {
        id: row.id,
        partnerId: row.partnerId,
        agentId: typeof row.agentId === "string" ? row.agentId : "",
        visitedAt: row.visitedAt,
        geo: point,
        note: typeof row.note === "string" ? row.note : "",
      },
    ];
  });
}
