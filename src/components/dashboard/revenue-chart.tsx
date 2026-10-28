"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr, formatWeight } from "@/lib/format";
import type { WeekBucket } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function RevenueChart({ weeks }: { weeks: WeekBucket[] }) {
  const [activeKey, setActiveKey] = useState(weeks[weeks.length - 1]?.key ?? "");
  const active = weeks.find((week) => week.key === activeKey) ?? weeks[weeks.length - 1];
  const max = Math.max(...weeks.map((week) => week.revenue), 1);

  return (
    <Card>
      <CardTitle>Pendapatan 8 minggu</CardTitle>
      <div className="flex h-48 items-end gap-1.5 sm:gap-2">
        {weeks.map((week) => {
          const height = Math.max(week.revenue > 0 ? 8 : 2, (week.revenue / max) * 100);
          const selected = week.key === active?.key;
          return (
            <button
              key={week.key}
              type="button"
              aria-pressed={selected}
              aria-label={`${week.label}: ${formatIdr(week.revenue)}, ${formatWeight(week.kilograms)}, ${week.orders} pesanan`}
              onClick={() => setActiveKey(week.key)}
              className="flex h-full min-h-11 min-w-0 flex-1 flex-col justify-end rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-800"
            >
              <span
                className={cn("block w-full rounded-t-md", selected ? "bg-forest-800" : "bg-forest-800/30")}
                style={{ height: `${height}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {weeks.map((week) => (
          <span key={week.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-slate-500 sm:text-xs">
            <span className="sm:hidden">{week.dayLabel}</span>
            <span className="hidden sm:inline">{week.label}</span>
          </span>
        ))}
      </div>
      {active ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-paper p-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Minggu {active.label}</dt>
            <dd className="font-semibold tabular-nums">{formatIdr(active.revenue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tonase</dt>
            <dd className="font-semibold tabular-nums">{formatWeight(active.kilograms)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pesanan</dt>
            <dd className="font-semibold tabular-nums">{active.orders}</dd>
          </div>
        </dl>
      ) : null}
    </Card>
  );
}
