import { connection } from "next/server";
import { parseLivestockBook } from "@/lib/livestock-store";
import { compilePayroll, isPayrollPeriod, markSlipPaid, type PayrollAdjustment } from "@/lib/payroll";
import { loadPayrollPeriod, persistPayroll } from "@/lib/payroll-db";
import { authorize } from "@/lib/session";
import { parseSalesBook } from "@/lib/storage";
import { parseUsersBook } from "@/lib/users-store";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readAdjustments(value: unknown): PayrollAdjustment[] | null {
  if (!Array.isArray(value)) return null;
  const adjustments: PayrollAdjustment[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const userId = row?.userId;
    const baseSalaryIdr = row?.baseSalaryIdr;
    const deductionsIdr = row?.deductionsIdr;
    if (typeof userId !== "string" || typeof baseSalaryIdr !== "number" || typeof deductionsIdr !== "number") return null;
    adjustments.push({ userId, baseSalaryIdr, deductionsIdr });
  }
  return adjustments;
}

export async function GET(request: Request) {
  await connection();
  const gate = await authorize("payroll", "read");
  if (!gate.ok) return gate.response;
  const period = new URL(request.url).searchParams.get("period") ?? "";
  if (!isPayrollPeriod(period)) return Response.json({ message: "Periode harus tahun-bulan, contoh 2026-10." }, { status: 400 });
  const saved = await loadPayrollPeriod(period);
  return Response.json({ ok: true, role: gate.role, stored: saved.stored, slips: saved.slips });
}

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("payroll", "update");
  if (!gate.ok) return gate.response;
  const body = asRecord(await request.json().catch(() => null));
  const period = typeof body?.period === "string" ? body.period : "";
  if (!isPayrollPeriod(period)) return Response.json({ message: "Periode harus tahun-bulan, contoh 2026-10." }, { status: 400 });
  const sales = parseSalesBook(body?.sales);
  const livestock = parseLivestockBook(body?.livestock);
  const users = parseUsersBook(body?.users);
  const adjustments = readAdjustments(body?.adjustments);
  if (!sales || !livestock || !users || !adjustments) {
    return Response.json({ message: "Buku penggajian tidak lengkap." }, { status: 400 });
  }
  const payUserId = typeof body?.payUserId === "string" ? body.payUserId : "";
  const saved = await loadPayrollPeriod(period);
  const compiled = compilePayroll({
    period,
    users: users.users,
    orders: sales.orders,
    healthLogs: livestock.healthLogs ?? [],
    animals: livestock.animals,
    waste: livestock.waste,
    adjustments,
    locked: saved.slips.filter((slip) => slip.status === "PAID"),
  });
  if (!compiled.ok) return Response.json({ message: compiled.message }, { status: 400 });
  if (payUserId && !compiled.value.slips.some((slip) => slip.userId === payUserId)) {
    return Response.json({ message: "Karyawan tidak ada pada periode ini." }, { status: 400 });
  }
  const paidAt = new Date().toISOString();
  const slips = compiled.value.slips.map((slip) => (payUserId && slip.userId === payUserId ? markSlipPaid(slip, paidAt) : slip));
  let stored = saved.stored;
  for (const slip of slips) {
    if (slip.status === "PAID" && saved.slips.some((item) => item.userId === slip.userId && item.status === "PAID")) continue;
    const result = await persistPayroll(slip);
    stored = stored && result.stored;
  }
  return Response.json({
    ok: true,
    role: gate.role,
    stored,
    slips,
    unassignedOrders: compiled.value.unassignedOrders,
    unassignedKg: compiled.value.unassignedKg,
    unassignedHealth: compiled.value.unassignedHealth,
  });
}
