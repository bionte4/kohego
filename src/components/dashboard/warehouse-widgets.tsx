"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useStore } from "@/components/providers/store-provider";
import { Badge } from "@/components/ui/badge";
import { DashboardSection } from "@/components/dashboard/section";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatIdr, formatWeight } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";
import type { DashboardMetrics } from "@/lib/metrics";
import { stockQty } from "@/lib/stock";

export function WarehouseWidgets({ metrics }: { metrics: DashboardMetrics }) {
  const { products, stock, warehouses, orders, partners } = useStore();
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const pending = orders.filter((order) => !order.settled).slice(0, 4);

  return (
    <DashboardSection title="Gudang" action={<CardLink href="/inventori">Inventori</CardLink>}>
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Card>
        <CardTitle>Stok kemasan</CardTitle>
        <ul className="divide-y divide-slate-100">
          {products.map((product) => {
            const qty = warehouses.reduce((sum, warehouse) => sum + stockQty(stock, warehouse.id, product.id), 0);
            return (
              <li key={product.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{product.label}</span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {qty} {packageUnitLabel(product.unit)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardTitle action={<CardLink href="/kandang">Produksi</CardLink>}>
          Batch konversi
        </CardTitle>
        {!book || book.batches.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada batch selesai.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {book.batches.slice(0, 4).map((batch) => {
              const product = products.find((item) => item.id === batch.variantId);
              return (
                <li key={batch.id} className="py-2 text-sm">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{product?.label ?? batch.variantId}</span>
                    <Badge tone="forest">Selesai</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {formatWeight(batch.rawKg)} → {batch.outputUnits} kemasan · {formatDateTime(batch.completedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-slate-600">
          Kohe tersedia {formatWeight(book ? book.waste.filter((row) => row.status === "tersedia").reduce((sum, row) => sum + row.massKg, 0) : 0)}.
        </p>
      </Card>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardTitle>Stok menipis</CardTitle>
        {metrics.lowStock.length === 0 ? (
          <p className="text-sm text-slate-500">Semua varian di atas batas minimum.</p>
        ) : (
          <ul className="space-y-2">
            {metrics.lowStock.slice(0, 4).map((item) => {
              const product = products.find((entry) => entry.id === item.variant);
              return (
                <li key={`${item.warehouseId}-${item.variant}`}>
                  <Link href="/inventori" className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{product?.label ?? item.variant}</span>
                      <span className="text-xs text-amber-900">{item.warehouseName}</span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {item.qty} {product ? packageUnitLabel(product.unit) : "kemasan"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Pesanan belum lunas</CardTitle>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada pesanan terbuka.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((order) => {
              const partner = partners.find((item) => item.id === order.partnerId);
              const amount = order.lines.reduce((sum, line) => sum + line.qty * line.unitPriceIdr, 0);
              return (
                <li key={order.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{order.code}</span>
                    <span className="text-xs text-slate-500">{partner?.name ?? "Mitra"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatIdr(amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
    </DashboardSection>
  );
}
