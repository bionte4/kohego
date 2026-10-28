"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useCan } from "@/components/access/role-provider";
import { useStoreState } from "@/components/providers/store-provider";
import { ResetDemoButton } from "@/components/layout/reset-demo-button";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { MixChart } from "@/components/dashboard/mix-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderList } from "@/components/sales/order-list";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { productById } from "@/lib/catalog";
import { formatIdr, formatIdrCompact } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import { buildDashboard } from "@/lib/metrics";

export function DashboardView() {
  const store = useStoreState();
  const canSettle = useCan("orders", "update");
  const metrics = useMemo(() => {
    if (!store.ready) return null;
    return buildDashboard(store);
  }, [store]);
  if (!store.ready || !metrics) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }
  const topRevenue = metrics.topPartners[0]?.revenue ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          Angka 30 hari dihitung dari pesanan di perangkat ini. Tonase hanya menghitung pupuk padat. Penagihan mencakup seluruh konsinyasi yang belum lunas.
        </p>
        <Link href="/penjualan" className={buttonClass("primary", "shrink-0")}>
          <ClipboardList className="h-4 w-4" aria-hidden />
          Catat pesanan
        </Link>
      </div>

      <KpiGrid metrics={metrics} />

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart weeks={metrics.weeks} />
        </div>
        <div className="lg:col-span-2">
          <MixChart slices={metrics.mix} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Mitra terbesar</CardTitle>
          {metrics.topPartners.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pembelian.</p>
          ) : (
            <ul className="space-y-3">
              {metrics.topPartners.map((partner) => (
                <li key={partner.partnerId}>
                  <Link href={`/mitra?id=${partner.partnerId}`} className="block min-h-11 rounded-xl">
                    <span className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{partner.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatIdrCompact(partner.revenue)}
                      </span>
                    </span>
                    <span className="block h-2 rounded-full bg-slate-100">
                      <span
                        className="block h-2 rounded-full bg-forest-800"
                        style={{ width: `${Math.max(8, (partner.revenue / topRevenue) * 100)}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            action={
              <Link href="/inventori" className="text-sm font-medium text-forest-800">
                Stok
              </Link>
            }
          >
            Perlu perhatian
          </CardTitle>
          <div className="space-y-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <AlertTriangle className="h-4 w-4 text-earth-800" aria-hidden />
                Jatuh tempo
              </p>
              {metrics.overdue.length === 0 ? (
                <p className="text-sm text-slate-500">Tidak ada tagihan jatuh tempo.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.overdue.slice(0, 4).map((item) => (
                    <li key={item.orderId}>
                      <Link
                        href={`/mitra?id=${item.partnerId}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.partnerName}</span>
                          <span className="text-xs text-red-800">
                            {item.code} · {item.daysPastDue} hari lewat tenor
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatIdr(item.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Stok menipis</p>
              {metrics.lowStock.length === 0 ? (
                <p className="text-sm text-slate-500">Semua varian di atas batas minimum.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.lowStock.map((item) => {
                    const product = productById(item.variant);
                    return (
                      <li key={`${item.warehouseId}-${item.variant}`}>
                        <Link
                          href="/inventori"
                          className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.warehouseName}</span>
                            <span className="text-xs text-amber-900">{product.label}</span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {item.qty} {packageUnitLabel(product.unit)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Pesanan terbaru</h2>
          <Link href="/penjualan" className="text-sm font-medium text-forest-800">
            Semua penjualan
          </Link>
        </div>
        <OrderList
          orders={metrics.recentOrders}
          partners={store.partners}
          warehouses={store.warehouses}
          onSettle={
            canSettle
              ? (id) => {
                  void store.settleOrder(id);
                }
              : undefined
          }
          empty="Belum ada pesanan."
        />
      </section>

      <div className="md:hidden">
        <ResetDemoButton className="text-earth-800" />
      </div>
    </div>
  );
}
