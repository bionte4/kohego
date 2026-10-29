"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/format";
import { PARTNER_TYPE_LABEL } from "@/lib/labels";
import type { DashboardMetrics } from "@/lib/metrics";

export function SalesShortcut() {
  return (
    <Card>
      <CardTitle>Pesanan lapangan</CardTitle>
      <p className="mb-4 text-sm leading-6 text-slate-600">Catat pembelian toko tani, perkebunan, atau urban farmer dari wilayah kerja Anda.</p>
      <Link href="/orders/fast" className={buttonClass("primary")}>
        <ClipboardList className="h-4 w-4" aria-hidden />
        Catat pesanan
      </Link>
    </Card>
  );
}

export function RegionalPartners({ metrics }: { metrics: DashboardMetrics }) {
  const { partners, profile } = useStore();
  const territory = profile.territory.toLowerCase();
  const matched = partners.filter((partner) => territory.includes(partner.region.toLowerCase()));
  const visible = (matched.length > 0 ? matched : partners).slice(0, 6);

  return (
    <Card>
      <CardTitle
        action={
          <CardLink href="/mitra">Semua mitra</CardLink>
        }
      >
        Mitra wilayah
      </CardTitle>
      <p className="mb-3 text-sm text-slate-600">{profile.territory}</p>
      <ul className="space-y-2">
        {visible.map((partner) => {
          const rank = metrics.topPartners.find((item) => item.partnerId === partner.id);
          return (
            <li key={partner.id}>
              <Link href={`/mitra?id=${partner.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 text-sm hover:bg-forest-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{partner.name}</span>
                  <span className="text-xs text-slate-500">
                    {partner.city} · {PARTNER_TYPE_LABEL[partner.type]}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-600">{rank ? formatIdr(rank.revenue) : partner.region}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function SalesPerformance({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    { label: "Pendapatan 30 hari", value: formatIdr(metrics.revenue30) },
    { label: "Pesanan", value: String(metrics.orders30) },
    { label: "Rata-rata nota", value: formatIdr(metrics.averageOrderValue) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="mt-2 font-display text-2xl leading-tight text-ink tabular-nums">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
