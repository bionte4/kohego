"use client";

import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PAYMENT_LABEL } from "@/lib/labels";
import { formatDateTime, formatIdr, formatWeight } from "@/lib/format";
import { describeSettlement, orderKilograms, orderRevenue } from "@/lib/order-math";
import type { Order, Partner, Warehouse } from "@/lib/types";

export function OrderList({
  orders,
  partners,
  warehouses,
  onSettle,
  onCancel,
  empty,
}: {
  orders: Order[];
  partners: Partner[];
  warehouses: Warehouse[];
  onSettle?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
  empty: string;
}) {
  const now = useMemo(() => new Date(), []);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (orders.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{empty}</p>;
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {orders.map((order) => {
          const partner = partners.find((item) => item.id === order.partnerId);
          const warehouse = warehouses.find((item) => item.id === order.warehouseId);
          const status = describeSettlement(order, partner, now);
          return (
            <li key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{order.code}</p>
                  <p className="truncate text-sm text-slate-600">{partner?.name ?? "Mitra"}</p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {formatDateTime(order.createdAt)} · {warehouse?.name}
              </p>
              <p className="mt-2 font-semibold tabular-nums">{formatIdr(orderRevenue(order))}</p>
              <p className="text-xs text-slate-500">
                {PAYMENT_LABEL[order.payment]} · {formatWeight(orderKilograms(order))}
                {order.geo ? (
                  <span className="inline-flex items-center gap-1">
                    {" "}
                    · <MapPin className="h-3.5 w-3.5" aria-hidden /> lokasi tertandai
                  </span>
                ) : null}
              </p>
              {order.note ? <p className="mt-2 text-sm text-slate-600">{order.note}</p> : null}
              <SettleAction
                order={order}
                pending={pendingId === order.id}
                onAsk={() => setPendingId(order.id)}
                onCancel={() => setPendingId(null)}
                onSettle={onSettle}
              />
              <CancelOrder orderId={order.id} onCancel={onCancel} />
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pesanan</th>
              <th className="px-4 py-3 font-medium">Mitra</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Pembayaran</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const partner = partners.find((item) => item.id === order.partnerId);
              const status = describeSettlement(order, partner, now);
              return (
                <tr key={order.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{order.code}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{partner?.name ?? "Mitra"}</p>
                    <p className="text-xs text-slate-500">{formatWeight(orderKilograms(order))}</p>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{formatIdr(orderRevenue(order))}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={order.payment === "konsinyasi" ? "earth" : "slate"}>
                        {PAYMENT_LABEL[order.payment]}
                      </Badge>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SettleAction
                      order={order}
                      pending={pendingId === order.id}
                      onAsk={() => setPendingId(order.id)}
                      onCancel={() => setPendingId(null)}
                      onSettle={onSettle}
                    />
                    <CancelOrder orderId={order.id} onCancel={onCancel} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettleAction({
  order,
  pending,
  onAsk,
  onCancel,
  onSettle,
}: {
  order: Order;
  pending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onSettle?: (orderId: string) => void;
}) {
  if (!onSettle || order.payment !== "konsinyasi" || order.settled) return null;
  if (!pending) {
    return (
      <Button variant="secondary" className="mt-3 md:mt-0" onClick={onAsk}>
        Tandai lunas
      </Button>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
      <Button
        onClick={() => {
          onSettle(order.id);
          onCancel();
        }}
      >
        Ya, tandai lunas
      </Button>
      <Button variant="secondary" onClick={onCancel}>
        Batal
      </Button>
    </div>
  );
}

function CancelOrder({ orderId, onCancel }: { orderId: string; onCancel?: (orderId: string) => void }) {
  const [ask, setAsk] = useState(false);
  if (!onCancel) return null;
  if (!ask) {
    return (
      <Button variant="danger" className="mt-3 md:mt-0" onClick={() => setAsk(true)}>
        Batalkan
      </Button>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
      <Button
        variant="danger"
        onClick={() => {
          onCancel(orderId);
          setAsk(false);
        }}
      >
        Ya, batalkan
      </Button>
      <Button variant="secondary" onClick={() => setAsk(false)}>
        Batal
      </Button>
    </div>
  );
}
