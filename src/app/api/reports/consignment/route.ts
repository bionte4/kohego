import { connection } from "next/server";
import { buildConsignmentLedger } from "@/lib/consignment";
import { persistConsignment, persistVisit } from "@/lib/enterprise-db";
import { isPayrollPeriod } from "@/lib/payroll";
import { authorize } from "@/lib/session";
import { parseSalesBook } from "@/lib/storage";
import type { FieldVisit } from "@/lib/types";

export async function POST(request: Request) {
  await connection();
  const gate = await authorize("orders", "read");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { period?: unknown; sales?: unknown; visit?: FieldVisit } | null;
  const period = typeof body?.period === "string" ? body.period : "";
  if (!isPayrollPeriod(period)) return Response.json({ message: "Periode harus tahun-bulan." }, { status: 400 });
  const sales = parseSalesBook(body?.sales);
  if (!sales) return Response.json({ message: "Buku penjualan tidak valid." }, { status: 400 });
  const rows = buildConsignmentLedger(sales.orders, sales.partners, period, new Date());
  const saved = await persistConsignment(period, rows);
  let visitStored = false;
  if (body?.visit && typeof body.visit.id === "string" && typeof body.visit.partnerId === "string") {
    const visit = await persistVisit(body.visit);
    visitStored = visit.stored;
  }
  return Response.json({ ok: true, stored: saved.stored, visitStored, rows });
}
