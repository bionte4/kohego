import type { HealthLog } from "@/lib/health";
import { expectedDailyManureKg, type Animal, type WasteOutput } from "@/lib/livestock";
import { orderKilograms } from "@/lib/order-math";
import { isRole, ROLE_LABEL, type Role } from "@/lib/rbac";
import type { Order } from "@/lib/types";
import type { StaffUser } from "@/lib/users";

/** Middle-tier rate. The band itself is chosen from monthly solid kilograms. */
export const COMMISSION_IDR_PER_KG = 250;

export const RESOLUTION_BONUS_IDR = 50_000;
export const WASTE_ACCURACY_BONUS_IDR = 150_000;

/** Rupiah paid to a farm manager for each animal whose latest check in the month stays out of the alert band. */
export const HEALTH_BONUS_IDR_PER_HEAD = 75_000;

/**
 * A herd check is successful care when its score stays at or above this line.
 * Scores under 70 are the same high-risk band the farm dashboard already flags.
 */
export const SUCCESSFUL_HEALTH_SCORE = 70;

/** Planning base before incentives. Super admin can replace these on a slip before it is paid. */
export const BASE_SALARY_IDR: Record<Role, number> = {
  SUPER_ADMIN: 8_000_000,
  FARM_MANAGER: 5_500_000,
  FARM_KEEPER: 3_800_000,
  WAREHOUSE_ADMIN: 4_200_000,
  FIELD_SALES: 3_500_000,
};

const MONEY_MAX = 100_000_000;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export type PayrollPayStatus = "PENDING" | "PAID";

export interface PayrollAdjustment {
  userId: string;
  baseSalaryIdr: number;
  deductionsIdr: number;
}

export interface PayrollLine {
  label: string;
  detail: string;
  amountIdr: number;
}

export interface PayrollSlip {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  period: string;
  baseSalaryIdr: number;
  commissionIdr: number;
  bonusIdr: number;
  deductionsIdr: number;
  grossIdr: number;
  netPayIdr: number;
  status: PayrollPayStatus;
  paidAt: string | null;
  tonnageKg: number;
  orderCount: number;
  healthHeads: number;
  lines: PayrollLine[];
  commissionRate?: number;
  resolvedHeads?: number;
  wasteAccuracy?: number | null;
}

export interface PayrollCompile {
  slips: PayrollSlip[];
  unassignedOrders: number;
  unassignedKg: number;
  unassignedHealth: number;
}

export function isPayrollPeriod(value: string) {
  return PERIOD.test(value);
}

/** Calendar month in Jakarta, so a late evening order stays in the working day the team sees. */
export function periodOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
}

export function shiftPeriod(period: string, delta: number) {
  const index = Number(period.slice(0, 4)) * 12 + (Number(period.slice(5, 7)) - 1) + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function periodLabel(period: string) {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${names[Number(period.slice(5, 7)) - 1] ?? period} ${period.slice(0, 4)}`;
}

export function commissionFor(kilograms: number) {
  if (kilograms >= 1500) return { rate: 300, label: "Tingkat tinggi" };
  if (kilograms >= 500) return { rate: 250, label: "Tingkat menengah" };
  return { rate: 200, label: "Tingkat dasar" };
}

export function payrollId(userId: string, period: string) {
  return `pay-${userId}-${period}`;
}

function measureWaste(animals: Animal[], waste: WasteOutput[], period: string) {
  const days = daysCovered(period);
  if (days <= 0 || animals.length === 0) return null;
  const expected = expectedDailyManureKg(animals) * days;
  if (expected <= 0) return null;
  const collected = waste.reduce((sum, row) => (periodOf(row.collectedAt) === period ? sum + row.massKg : sum), 0);
  return Math.round((1 - Math.abs(collected - expected) / expected) * 1000) / 1000;
}

function daysCovered(period: string) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const length = new Date(year, month, 0).getDate();
  const today = periodOf(new Date().toISOString());
  if (today === period) {
    return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" }).format(new Date()));
  }
  return today > period ? length : 0;
}

function soleActive(users: StaffUser[], role: Role) {
  const matches = users.filter((user) => user.active && user.role === role);
  return matches.length === 1 ? matches[0].id : null;
}

function money(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MONEY_MAX;
}

function roundKg(value: number) {
  return Math.round(value * 1000) / 1000;
}

function kilograms(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

export function describeSlip(slip: Omit<PayrollSlip, "lines">): PayrollLine[] {
  const lines: PayrollLine[] = [{ label: "Gaji pokok", detail: ROLE_LABEL[slip.role], amountIdr: slip.baseSalaryIdr }];
  if (slip.role === "FIELD_SALES") {
    const priced = commissionFor(slip.tonnageKg);
    const rate = slip.commissionRate ?? priced.rate;
    lines.push({
      label: "Komisi penjualan",
      detail: `${slip.orderCount} pesanan · ${kilograms(slip.tonnageKg)} kg × Rp ${rupiah(rate)} · ${priced.label}`,
      amountIdr: slip.commissionIdr,
    });
  }
  if (slip.role === "FARM_MANAGER") {
    lines.push({
      label: "Bonus pemeriksaan",
      detail: `${slip.healthHeads} ternak skor minimal ${SUCCESSFUL_HEALTH_SCORE} × Rp ${rupiah(HEALTH_BONUS_IDR_PER_HEAD)}`,
      amountIdr: slip.healthHeads * HEALTH_BONUS_IDR_PER_HEAD,
    });
    if (typeof slip.resolvedHeads === "number") {
      lines.push({
        label: "Bonus pemulihan",
        detail: `${slip.resolvedHeads} ternak pulih dari skor di bawah ${SUCCESSFUL_HEALTH_SCORE} × Rp ${rupiah(RESOLUTION_BONUS_IDR)}`,
        amountIdr: slip.resolvedHeads * RESOLUTION_BONUS_IDR,
      });
    }
    if (typeof slip.wasteAccuracy === "number" || slip.wasteAccuracy === null) {
      const accuracy = slip.wasteAccuracy;
      const accurate = typeof accuracy === "number" && accuracy >= 0.85;
      lines.push({
        label: "Bonus akurasi kohe",
        detail: accurate ? `Selisih catatan dan proyeksi ${Math.round((1 - accuracy) * 100)}%` : "Selisih catatan kohe lebih dari 15%",
        amountIdr: accurate ? WASTE_ACCURACY_BONUS_IDR : 0,
      });
    }
  }
  if (slip.deductionsIdr > 0) {
    lines.push({ label: "Potongan", detail: "Dipotong dari gaji kotor", amountIdr: -slip.deductionsIdr });
  }
  return lines;
}

export function markSlipPaid(slip: PayrollSlip, paidAt: string): PayrollSlip {
  return { ...slip, status: "PAID", paidAt };
}

/**
 * Compiles one month of pay.
 * Field sales earn commission on solid kilograms from fast orders they booked.
 * Farm managers earn a bonus for each animal whose latest check that month scores 70 or more.
 * Orders and checks saved before a person was recorded fall to the only active person in that role.
 * A paid slip stays frozen so a later edit cannot rewrite a completed payment.
 */
export function compilePayroll(input: {
  period: string;
  users: StaffUser[];
  orders: Order[];
  healthLogs: HealthLog[];
  animals?: Animal[];
  waste?: WasteOutput[];
  adjustments?: PayrollAdjustment[];
  locked?: PayrollSlip[];
}): { ok: true; value: PayrollCompile } | { ok: false; message: string } {
  if (!isPayrollPeriod(input.period)) return { ok: false, message: "Periode harus tahun-bulan, contoh 2026-10." };
  const adjustments = new Map((input.adjustments ?? []).map((item) => [item.userId, item]));
  for (const item of adjustments.values()) {
    if (!money(item.baseSalaryIdr) || !money(item.deductionsIdr)) {
      return { ok: false, message: "Gaji pokok dan potongan harus bilangan bulat rupiah." };
    }
  }

  const staff = input.users.filter((user) => user.active);
  const activeIds = new Map(staff.map((user) => [user.id, user]));
  const fieldFallback = soleActive(staff, "FIELD_SALES");
  const farmFallback = soleActive(staff, "FARM_MANAGER");
  const locked = new Map(
    (input.locked ?? [])
      .filter((slip) => slip.period === input.period && slip.status === "PAID" && activeIds.has(slip.userId))
      .map((slip) => [slip.userId, slip]),
  );

  const sales = new Map<string, { kg: number; orders: number }>();
  let unassignedOrders = 0;
  let unassignedKg = 0;
  for (const order of input.orders) {
    if (periodOf(order.createdAt) !== input.period) continue;
    const named = order.agentId && activeIds.get(order.agentId)?.role === "FIELD_SALES" ? order.agentId : null;
    const owner = named ?? (order.agentId ? null : fieldFallback);
    const kg = orderKilograms(order);
    if (!owner) {
      unassignedOrders += 1;
      unassignedKg += kg;
      continue;
    }
    const current = sales.get(owner) ?? { kg: 0, orders: 0 };
    current.kg += kg;
    current.orders += 1;
    sales.set(owner, current);
  }

  const grouped = new Map<string, HealthLog[]>();
  for (const log of input.healthLogs) {
    if (periodOf(log.checkedAt) !== input.period) continue;
    const rows = grouped.get(log.earTag) ?? [];
    rows.push(log);
    grouped.set(log.earTag, rows);
  }
  const health = new Map<string, number>();
  const resolved = new Map<string, number>();
  let unassignedHealth = 0;
  for (const logs of grouped.values()) {
    const ordered = [...logs].sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));
    const last = ordered[ordered.length - 1];
    if (!last) continue;
    const named = last.recordedBy && activeIds.get(last.recordedBy)?.role === "FARM_MANAGER" ? last.recordedBy : null;
    const owner = named ?? (last.recordedBy ? null : farmFallback);
    if (last.score >= SUCCESSFUL_HEALTH_SCORE) {
      if (!owner) unassignedHealth += 1;
      else health.set(owner, (health.get(owner) ?? 0) + 1);
    }
    const recovered = ordered.some((item) => item.score < SUCCESSFUL_HEALTH_SCORE) && last.score >= SUCCESSFUL_HEALTH_SCORE;
    if (recovered && owner) resolved.set(owner, (resolved.get(owner) ?? 0) + 1);
  }
  const wasteAccuracy = measureWaste(input.animals ?? [], input.waste ?? [], input.period);

  const slips: PayrollSlip[] = [];
  for (const user of staff) {
    const frozen = locked.get(user.id);
    if (frozen) {
      const kept = { ...frozen, name: user.name, email: user.email, role: user.role };
      slips.push({ ...kept, lines: describeSlip(kept) });
      continue;
    }
    const adjustment = adjustments.get(user.id);
    const baseSalaryIdr = adjustment?.baseSalaryIdr ?? BASE_SALARY_IDR[user.role];
    const deductionsIdr = adjustment?.deductionsIdr ?? 0;
    const sold = user.role === "FIELD_SALES" ? sales.get(user.id) ?? { kg: 0, orders: 0 } : { kg: 0, orders: 0 };
    const heads = user.role === "FARM_MANAGER" ? health.get(user.id) ?? 0 : 0;
    const resolvedHeads = user.role === "FARM_MANAGER" ? resolved.get(user.id) ?? 0 : 0;
    const tonnageKg = roundKg(sold.kg);
    const priced = commissionFor(tonnageKg);
    const commissionIdr = user.role === "FIELD_SALES" ? Math.round(tonnageKg * priced.rate) : 0;
    const wasteBonus = user.role === "FARM_MANAGER" && typeof wasteAccuracy === "number" && wasteAccuracy >= 0.85 ? WASTE_ACCURACY_BONUS_IDR : 0;
    const bonusIdr = heads * HEALTH_BONUS_IDR_PER_HEAD + resolvedHeads * RESOLUTION_BONUS_IDR + wasteBonus;
    const grossIdr = baseSalaryIdr + commissionIdr + bonusIdr;
    if (deductionsIdr > grossIdr) return { ok: false, message: `Potongan ${user.name} melebihi gaji kotor.` };
    const draft = {
      id: payrollId(user.id, input.period),
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      period: input.period,
      baseSalaryIdr,
      commissionIdr,
      bonusIdr,
      deductionsIdr,
      grossIdr,
      netPayIdr: grossIdr - deductionsIdr,
      status: "PENDING" as const,
      paidAt: null,
      tonnageKg,
      orderCount: sold.orders,
      healthHeads: heads,
      commissionRate: user.role === "FIELD_SALES" ? priced.rate : undefined,
      resolvedHeads: user.role === "FARM_MANAGER" ? resolvedHeads : undefined,
      wasteAccuracy: user.role === "FARM_MANAGER" ? wasteAccuracy : undefined,
    };
    slips.push({ ...draft, lines: describeSlip(draft) });
  }

  slips.sort((left, right) => left.name.localeCompare(right.name, "id"));
  return { ok: true, value: { slips, unassignedOrders, unassignedKg: roundKg(unassignedKg), unassignedHealth } };
}

export function isPayrollSlip(value: unknown): value is PayrollSlip {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PayrollSlip>;
  return (
    typeof row.id === "string" &&
    typeof row.userId === "string" &&
    typeof row.name === "string" &&
    typeof row.email === "string" &&
    isRole(row.role) &&
    typeof row.period === "string" &&
    isPayrollPeriod(row.period) &&
    Number.isInteger(row.baseSalaryIdr) &&
    Number.isInteger(row.commissionIdr) &&
    Number.isInteger(row.bonusIdr) &&
    Number.isInteger(row.deductionsIdr) &&
    Number.isInteger(row.grossIdr) &&
    Number.isInteger(row.netPayIdr) &&
    (row.status === "PENDING" || row.status === "PAID") &&
    (row.paidAt === null || typeof row.paidAt === "string") &&
    typeof row.tonnageKg === "number" &&
    Number.isInteger(row.orderCount) &&
    Number.isInteger(row.healthHeads) &&
    Array.isArray(row.lines)
  );
}
