import { BadgePercent, Banknote, Scale, Users } from "lucide-react";
import { formatDelta, formatIdr, formatPercent, formatVolume, formatWeight } from "@/lib/format";
import type { DashboardMetrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return <p className="mt-1 text-xs text-slate-500">Belum ada 30 hari pembanding</p>;
  }
  const up = value >= 0;
  return (
    <p className={cn("mt-1 text-xs font-medium", up ? "text-forest-800" : "text-earth-800")}>
      {formatDelta(value)} vs 30 hari sebelumnya
    </p>
  );
}

export function KpiGrid({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    {
      label: "Pendapatan",
      value: formatIdr(metrics.revenue30),
      icon: Banknote,
      hint: <Trend value={metrics.revenueDelta} />,
    },
    {
      label: "Tonase terjual",
      value: formatWeight(metrics.tonnageKg30),
      icon: Scale,
      hint: (
        <p className="mt-1 text-xs text-slate-500">
          {metrics.liters30 > 0 ? `${formatVolume(metrics.liters30)} POC · ` : null}
          30 hari terakhir
        </p>
      ),
    },
    {
      label: "Mitra aktif",
      value: String(metrics.activePartners),
      icon: Users,
      hint: (
        <p className="mt-1 text-xs text-slate-500">dari {metrics.totalPartners} mitra terdaftar</p>
      ),
    },
    {
      label: "Penagihan",
      value: formatPercent(metrics.collectionRate),
      icon: BadgePercent,
      hint: (
        <p className="mt-1 text-xs text-slate-500">{formatIdr(metrics.outstanding)} belum tertagih</p>
      ),
    },
  ];

  const tiles = [
    { label: "Rata-rata pesanan", value: formatIdr(metrics.averageOrderValue), hint: "30 hari terakhir" },
    { label: "Mitra repeat", value: formatPercent(metrics.repeatRate), hint: "pernah beli lebih dari sekali" },
    { label: "Piutang", value: formatIdr(metrics.outstanding), hint: "konsinyasi belum lunas" },
    { label: "Pesanan", value: String(metrics.orders30), hint: "30 hari terakhir" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-500">{card.label}</p>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-800">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 font-display text-xl leading-tight tracking-tight text-ink tabular-nums sm:text-2xl">
                {card.value}
              </p>
              {card.hint}
            </article>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <article key={tile.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{tile.label}</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-ink">{tile.value}</p>
            <p className="mt-1 text-xs text-slate-500">{tile.hint}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
