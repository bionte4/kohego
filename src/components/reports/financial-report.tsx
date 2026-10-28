"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useStoreState } from "@/components/providers/store-provider";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatVolume, formatWeight } from "@/lib/format";
import { buildFinancialReport, downloadReportCsv, printFinancialReport, type ReportPeriod } from "@/lib/reports";
import { cn } from "@/lib/utils";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "day", label: "Harian" },
  { id: "month", label: "Bulanan" },
  { id: "year", label: "Tahunan" },
];

export function FinancialReportView() {
  const store = useStoreState();
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const now = useMemo(() => (store.ready ? new Date() : null), [store.ready]);
  const report = useMemo(() => {
    if (!store.ready || !now) return null;
    return buildFinancialReport(store, period, now);
  }, [store, period, now]);

  if (!store.ready || !report) {
    return <p className="text-sm text-slate-500">Menyiapkan laporan...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={period === item.id}
              onClick={() => setPeriod(item.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                period === item.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("secondary")} onClick={() => downloadReportCsv(report)}>
            <Download className="h-4 w-4" aria-hidden />
            Unduh CSV
          </button>
          <button type="button" className={buttonClass("primary")} onClick={printFinancialReport}>
            <Printer className="h-4 w-4" aria-hidden />
            Cetak PDF
          </button>
        </div>
      </div>

      <div id="laporan-keuangan" className="space-y-4">
        <p className="text-sm text-slate-600">{report.label}. Bersih hanya menghitung pembayaran yang sudah masuk.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-sm text-slate-500">Pendapatan kotor</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{formatIdr(report.grossIdr)}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Pendapatan bersih</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatIdr(report.netIdr)}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Tonase terjual</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatWeight(report.tonnageKg)}</p>
            {report.liters > 0 ? <p className="mt-1 text-sm text-slate-500">Cair {formatVolume(report.liters)}</p> : null}
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Konsinyasi belum lunas</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-earth-800">{formatIdr(report.consignmentOpenIdr)}</p>
          </Card>
        </div>

        <Card>
          <h2 className="font-display text-xl text-ink">Tunai dan konsinyasi</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-forest-50 px-3 py-3">
              <dt className="text-sm text-slate-600">Tunai dan transfer</dt>
              <dd className="mt-1 font-semibold tabular-nums">{formatIdr(report.cashIdr)}</dd>
            </div>
            <div className="rounded-xl bg-earth-50 px-3 py-3">
              <dt className="text-sm text-slate-600">Konsinyasi belum lunas</dt>
              <dd className="mt-1 font-semibold tabular-nums text-earth-800">{formatIdr(report.consignmentOpenIdr)}</dd>
            </div>
            <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
              <dt className="text-sm text-slate-600">Konsinyasi lunas</dt>
              <dd className="mt-1 font-semibold tabular-nums">{formatIdr(report.consignmentSettledIdr)}</dd>
            </div>
          </dl>
        </Card>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-forest-50 text-forest-950">
              <tr>
                {["Nota", "Tanggal", "Mitra", "Varian", "Status bayar", "Nilai"].map((label) => (
                  <th key={label} className="px-3 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Belum ada transaksi pada periode ini.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr key={`${row.orderId}-${row.variantLabel}-${row.qty}`} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold">{row.code}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(row.createdAt)}</td>
                    <td className="px-3 py-3">{row.partnerName}</td>
                    <td className="px-3 py-3">
                      {row.variantLabel}
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {row.qty} {row.unit}
                      </span>
                    </td>
                    <td className={cn("px-3 py-3", row.collected ? "text-slate-700" : "font-medium text-earth-800")}>{row.statusLabel}</td>
                    <td className="px-3 py-3 font-medium tabular-nums">{formatIdr(row.amountIdr)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
