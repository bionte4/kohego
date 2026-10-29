"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth, useCan } from "@/components/access/role-provider";
import { FarmWidgets } from "@/components/dashboard/farm-widgets";
import { PublisherWidget } from "@/components/dashboard/publisher-widget";
import { RegionalPartners, SalesPerformance, SalesShortcut } from "@/components/dashboard/sales-widgets";
import { WarehouseWidgets } from "@/components/dashboard/warehouse-widgets";
import { useStoreState } from "@/components/providers/store-provider";
import { ResetDemoButton } from "@/components/layout/reset-demo-button";
import { DashboardSection } from "@/components/dashboard/section";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { MixChart } from "@/components/dashboard/mix-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { OrderList } from "@/components/sales/order-list";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { productById } from "@/lib/catalog";
import { formatIdr, formatIdrCompact } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import { buildDashboard } from "@/lib/metrics";

export function DashboardView() {
  const store = useStoreState();
  const { role } = useAuth();
  const canSettle = useCan("orders", "update");
  const metrics = useMemo(() => {
    if (!store.ready) return null;
    return buildDashboard(store);
  }, [store]);
  if (!store.ready || !metrics) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }
  const topRevenue = metrics.topPartners[0]?.revenue ?? 1;
  const showFarm = role === "FARM_MANAGER" || role === "SUPER_ADMIN";
  const showWarehouse = role === "WAREHOUSE_ADMIN" || role === "SUPER_ADMIN";
  const showSales = role === "FIELD_SALES" || role === "SUPER_ADMIN" || role === null;
  const showPublisher = role === "SUPER_ADMIN";
  const intro =
    role === "FARM_MANAGER"
      ? "Populasi, kesehatan, dan kohe yang masih bisa dikemas."
      : role === "WAREHOUSE_ADMIN"
        ? "Stok kemasan, batch konversi, dan pesanan yang belum lunas."
        : role === "FIELD_SALES"
          ? "Penjualan di perangkat ini dan mitra di wilayah kerja."
          : "Kandang dan gudang di atas, penjualan 30 hari di bawah. Tonase hanya menghitung pupuk padat.";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">{intro}</p>
        {showSales && role !== "FIELD_SALES" ? (
          <Link href="/orders/fast" className={buttonClass("primary", "shrink-0")}>
            <ClipboardList className="h-4 w-4" aria-hidden />
            Catat pesanan
          </Link>
        ) : null}
      </div>

      {showFarm ? <FarmWidgets /> : null}
      {showWarehouse ? <WarehouseWidgets metrics={metrics} /> : null}
      {role === "FIELD_SALES" ? (
        <DashboardSection title="Penjualan">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <SalesShortcut />
            <RegionalPartners metrics={metrics} />
          </div>
          <SalesPerformance metrics={metrics} />
        </DashboardSection>
      ) : null}
      {showSales && role !== "FIELD_SALES" ? (
        <DashboardSection title="Penjualan">
      <KpiGrid metrics={metrics} />

      <div className="grid items-stretch gap-3 lg:grid-cols-5">
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
                  <Link href={`/mitra?id=${partner.partnerId}`} className="block min-h-11 rounded-xl px-2 py-1 hover:bg-forest-50">
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
              <CardLink href="/inventori">Stok</CardLink>
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
                    const product = productById(item.variant, store.products);
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

      <div className="space-y-3">
        <h3 className="font-display text-xl text-ink">Pesanan terbaru</h3>
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
      </div>

      <div className="md:hidden">
        <ResetDemoButton className="text-earth-800" />
      </div>
        </DashboardSection>
      ) : null}
      {showPublisher ? <PublisherWidget /> : null}
    </div>
  );
}
