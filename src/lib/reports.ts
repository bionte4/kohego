import { formatDateTime } from "@/lib/format";
import { packageUnitLabel, PAYMENT_LABEL } from "@/lib/labels";
import { isCollected, orderKilograms, orderLiters, orderRevenue } from "@/lib/order-math";
import type { AppData, Order, PaymentMethod, Product } from "@/lib/types";

export type ReportPeriod = "day" | "month" | "year";

export interface ReportLedgerRow {
  orderId: string;
  code: string;
  createdAt: string;
  partnerName: string;
  variantLabel: string;
  qty: number;
  unit: string;
  payment: PaymentMethod;
  collected: boolean;
  statusLabel: string;
  amountIdr: number;
}

export interface FinancialReport {
  period: ReportPeriod;
  label: string;
  /** Booked value of every order in the period, including open consignment. */
  grossIdr: number;
  /** Collected value. Open consignment is excluded because it is not cash yet. */
  netIdr: number;
  tonnageKg: number;
  liters: number;
  cashIdr: number;
  consignmentOpenIdr: number;
  consignmentSettledIdr: number;
  rows: ReportLedgerRow[];
}

const PERIOD_TITLE: Record<ReportPeriod, string> = {
  day: "Hari ini",
  month: "Bulan ini",
  year: "Tahun ini",
};

export function periodRange(period: ReportPeriod, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (period === "day") {
    end.setDate(end.getDate() + 1);
  } else if (period === "month") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {
    start.setMonth(0, 1);
    end.setTime(start.getTime());
    end.setFullYear(end.getFullYear() + 1);
  }
  const when = new Intl.DateTimeFormat("id-ID", {
    day: period === "day" ? "numeric" : undefined,
    month: period === "year" ? undefined : "long",
    year: "numeric",
  }).format(start);
  return { start, end, label: `${PERIOD_TITLE[period]} · ${when}` };
}

function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function variantName(products: Product[], variant: string) {
  return products.find((product) => product.id === variant)?.label ?? variant;
}

function variantUnit(products: Product[], variant: string) {
  const product = products.find((item) => item.id === variant);
  return packageUnitLabel(product?.unit ?? "sak");
}

function statusLabel(order: Order) {
  if (order.payment === "konsinyasi") return order.settled ? "Konsinyasi lunas" : "Konsinyasi belum lunas";
  return PAYMENT_LABEL[order.payment];
}

export function buildFinancialReport(
  data: Pick<AppData, "orders" | "partners" | "products">,
  period: ReportPeriod,
  now: Date,
): FinancialReport {
  const range = periodRange(period, now);
  const orders = data.orders.filter((order) => inRange(order.createdAt, range.start, range.end));
  const rows: ReportLedgerRow[] = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .flatMap((order) => {
      const partner = data.partners.find((item) => item.id === order.partnerId);
      const collected = isCollected(order);
      return order.lines.map((line) => ({
        orderId: order.id,
        code: order.code,
        createdAt: order.createdAt,
        partnerName: partner?.name ?? "Mitra",
        variantLabel: variantName(data.products, line.variant),
        qty: line.qty,
        unit: variantUnit(data.products, line.variant),
        payment: order.payment,
        collected,
        statusLabel: statusLabel(order),
        amountIdr: line.qty * line.unitPriceIdr,
      }));
    });

  let cashIdr = 0;
  let consignmentOpenIdr = 0;
  let consignmentSettledIdr = 0;
  for (const order of orders) {
    const value = orderRevenue(order);
    if (order.payment === "konsinyasi") {
      if (order.settled) consignmentSettledIdr += value;
      else consignmentOpenIdr += value;
    } else {
      cashIdr += value;
    }
  }

  return {
    period,
    label: range.label,
    grossIdr: orders.reduce((sum, order) => sum + orderRevenue(order), 0),
    netIdr: orders.reduce((sum, order) => sum + (isCollected(order) ? orderRevenue(order) : 0), 0),
    tonnageKg: orders.reduce((sum, order) => sum + orderKilograms(order), 0),
    liters: orders.reduce((sum, order) => sum + orderLiters(order), 0),
    cashIdr,
    consignmentOpenIdr,
    consignmentSettledIdr,
    rows,
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function reportCsv(report: FinancialReport) {
  const header = ["Nota", "Tanggal", "Mitra", "Varian", "Jumlah", "Status bayar", "Nilai"];
  const lines = report.rows.map((row) =>
    [
      row.code,
      formatDateTime(row.createdAt),
      row.partnerName,
      row.variantLabel,
      `${row.qty} ${row.unit}`,
      row.statusLabel,
      row.amountIdr,
    ]
      .map(csvCell)
      .join(","),
  );
  const summary = [
    [],
    ["Periode", report.label],
    ["Pendapatan kotor", report.grossIdr],
    ["Pendapatan bersih", report.netIdr],
    ["Tonase kg", report.tonnageKg],
    ["Tunai dan transfer", report.cashIdr],
    ["Konsinyasi belum lunas", report.consignmentOpenIdr],
    ["Konsinyasi lunas", report.consignmentSettledIdr],
  ].map((line) => line.map(csvCell).join(","));
  return `\uFEFF${[header.join(","), ...lines, ...summary].join("\n")}`;
}

export function downloadReportCsv(report: FinancialReport) {
  const stamp = report.label.replace(/[^\dA-Za-z]+/g, "-").replace(/^-|-$/g, "");
  const blob = new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kohego-laporan-${stamp || "keuangan"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function printFinancialReport() {
  window.print();
}
