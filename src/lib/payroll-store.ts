import type { PayrollSlip } from "@/lib/payroll";
import { isPayrollSlip } from "@/lib/payroll";

export const PAYROLL_KEY = "kohego.payroll.v1";

export interface PayrollBook {
  version: 1;
  records: PayrollSlip[];
}

function emptyBook(): PayrollBook {
  return { version: 1, records: [] };
}

export function parsePayrollBook(input: unknown): PayrollBook | null {
  if (!input || typeof input !== "object") return null;
  const parsed = input as { version?: number; records?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.records)) return null;
  return { version: 1, records: parsed.records.filter(isPayrollSlip) };
}

export function loadPayroll(): PayrollBook {
  try {
    const raw = localStorage.getItem(PAYROLL_KEY);
    if (!raw) return emptyBook();
    return parsePayrollBook(JSON.parse(raw) as unknown) ?? emptyBook();
  } catch {
    return emptyBook();
  }
}

let memory: PayrollBook | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePayroll(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPayrollClient() {
  if (!memory) memory = loadPayroll();
  return memory;
}

export function getPayrollServer(): PayrollBook | null {
  return null;
}

export function replacePayrollPeriod(period: string, slips: PayrollSlip[]) {
  const current = getPayrollClient();
  const next = { version: 1 as const, records: [...current.records.filter((item) => item.period !== period), ...slips] };
  memory = next;
  try {
    localStorage.setItem(PAYROLL_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  emit();
  return true;
}
