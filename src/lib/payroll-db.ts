import { Prisma } from "@prisma/client";
import { describeSlip, isPayrollPeriod, type PayrollSlip } from "@/lib/payroll";
import { isRole } from "@/lib/rbac";
import { getDb } from "@/lib/social/db";

function slipFromRow(row: {
  id: string;
  userId: string;
  period: string;
  role: string;
  baseSalaryIdr: number;
  commissionIdr: number;
  bonusIdr: number;
  deductionsIdr: number;
  netPayIdr: number;
  tonnageKg: Prisma.Decimal;
  orderCount: number;
  healthHeads: number;
  status: "PENDING" | "PAID";
  paidAt: Date | null;
  credential: { name: string; email: string; role: string };
}): PayrollSlip | null {
  if (!isRole(row.role) || !isPayrollPeriod(row.period)) return null;
  const draft = {
    id: row.id,
    userId: row.userId,
    name: row.credential.name,
    email: row.credential.email,
    role: row.role,
    period: row.period,
    baseSalaryIdr: row.baseSalaryIdr,
    commissionIdr: row.commissionIdr,
    bonusIdr: row.bonusIdr,
    deductionsIdr: row.deductionsIdr,
    grossIdr: row.baseSalaryIdr + row.commissionIdr + row.bonusIdr,
    netPayIdr: row.netPayIdr,
    status: row.status,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    tonnageKg: Number(row.tonnageKg),
    orderCount: row.orderCount,
    healthHeads: row.healthHeads,
  };
  return { ...draft, lines: describeSlip(draft) };
}

export async function loadPayrollPeriod(period: string) {
  const db = getDb();
  if (!db) return { stored: false as const, slips: [] as PayrollSlip[] };
  try {
    const rows = await db.payrollRecord.findMany({
      where: { period },
      include: { credential: true },
      orderBy: { userId: "asc" },
    });
    return { stored: true as const, slips: rows.flatMap((row) => {
      const slip = slipFromRow(row);
      return slip ? [slip] : [];
    }) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      return { stored: false as const, slips: [] as PayrollSlip[] };
    }
    throw error;
  }
}

/** Writes one slip. A paid row is left as it was so a later compile cannot reopen it. */
export async function persistPayroll(slip: PayrollSlip) {
  const db = getDb();
  if (!db) return { stored: false as const };
  try {
    const existing = await db.payrollRecord.findUnique({ where: { userId_period: { userId: slip.userId, period: slip.period } } });
    if (existing?.status === "PAID") return { stored: true as const };
    const data = {
      role: slip.role,
      baseSalaryIdr: slip.baseSalaryIdr,
      commissionIdr: slip.commissionIdr,
      bonusIdr: slip.bonusIdr,
      deductionsIdr: slip.deductionsIdr,
      netPayIdr: slip.netPayIdr,
      tonnageKg: slip.tonnageKg.toFixed(3),
      orderCount: slip.orderCount,
      healthHeads: slip.healthHeads,
      status: slip.status,
      paidAt: slip.paidAt ? new Date(slip.paidAt) : null,
    };
    await db.payrollRecord.upsert({
      where: { userId_period: { userId: slip.userId, period: slip.period } },
      create: { id: slip.id, userId: slip.userId, period: slip.period, ...data },
      update: data,
    });
    return { stored: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2021" || error.code === "P2022")) {
      return { stored: false as const };
    }
    throw error;
  }
}
