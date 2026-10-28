"use client";

import { useMemo, useState } from "react";
import { useCan } from "@/components/access/role-provider";
import { InvoiceModal } from "@/components/orders/InvoiceModal";
import { useStoreState } from "@/components/providers/store-provider";
import { OrderForm } from "@/components/sales/order-form";
import { OrderList } from "@/components/sales/order-list";
import { Card, CardTitle } from "@/components/ui/card";
import { isSameDay } from "@/lib/format";
import { isCollected } from "@/lib/order-math";
import { cn } from "@/lib/utils";

type OrderFilter = "all" | "today" | "open";

export function SalesView() {
  const store = useStoreState();
  const canCreate = useCan("orders", "create");
  const canUpdate = useCan("orders", "update");
  const canDelete = useCan("orders", "delete");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const now = useMemo(() => (store.ready ? new Date() : null), [store.ready]);

  const filtered = useMemo(() => {
    if (!store.ready || !now) return [];
    return store.orders.filter((order) => {
      if (filter === "today") return isSameDay(order.createdAt, now);
      if (filter === "open") return !isCollected(order);
      return true;
    });
  }, [store, filter, now]);

  if (!store.ready) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }

  const { partners, warehouses } = store;
  const visible = showAll ? filtered : filtered.slice(0, 8);
  const receipt = store.orders.find((order) => order.id === receiptId) ?? null;

  return (
    <div className="grid items-start gap-6 pb-24 md:pb-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      {canCreate ? (
        <OrderForm onCreated={setReceiptId} />
      ) : (
        <Card>
          <CardTitle>Pesanan cepat</CardTitle>
          <p className="text-sm leading-6 text-slate-600">Pencatatan pesanan tersedia untuk penjualan lapangan dan super admin.</p>
        </Card>
      )}
      <section className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Pesanan tercatat</h2>
          <p className="text-sm text-slate-500">{filtered.length}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ["all", "Semua"],
              ["today", "Hari ini"],
              ["open", "Belum lunas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setShowAll(false);
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                filter === id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <OrderList
          orders={visible}
          partners={partners}
          warehouses={warehouses}
          onSettle={
            canUpdate
              ? (id) => {
                  void store.settleOrder(id);
                }
              : undefined
          }
          onCancel={
            canDelete
              ? (id) => {
                  void store.cancelOrder(id);
                }
              : undefined
          }
          onReceipt={setReceiptId}
          empty={filter === "today" ? "Belum ada pesanan hari ini." : "Belum ada pesanan pada filter ini."}
        />
        {filtered.length > visible.length ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-11 text-sm font-medium text-forest-800"
          >
            Tampilkan semua ({filtered.length})
          </button>
        ) : null}
      </section>
      <InvoiceModal
        order={receipt}
        partner={partners.find((partner) => partner.id === receipt?.partnerId)}
        warehouse={warehouses.find((warehouse) => warehouse.id === receipt?.warehouseId)}
        products={store.products}
        onClose={() => setReceiptId(null)}
      />
    </div>
  );
}
