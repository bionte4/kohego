"use client";

import { useSyncExternalStore } from "react";
import { HealthAlertBanner } from "@/components/kandang/health-alert-banner";
import { DashboardSection } from "@/components/dashboard/section";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatWeight } from "@/lib/format";
import { herdPopulation, wasteIntake, weightLeaders } from "@/lib/role-dashboard";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";

export function FarmWidgets() {
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  if (!book) return <p className="text-sm text-slate-500">Menyiapkan ringkasan kandang...</p>;
  const population = herdPopulation(book);
  const intake = wasteIntake(book, new Date());
  const leaders = weightLeaders(book);
  const quarantine = population.reduce((sum, row) => sum + row.quarantine, 0);
  const active = population.reduce((sum, row) => sum + row.heads, 0);

  return (
    <DashboardSection
      title="Kandang"
      action={
        <>
          <CardLink href="/livestock/health">Kesehatan</CardLink>
          <CardLink href="/livestock/treatments">Jadwal</CardLink>
          <CardLink href="/kandang">Kandang</CardLink>
        </>
      }
    >
      <HealthAlertBanner book={book} />
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardTitle>Populasi ternak</CardTitle>
          <p className="mb-3 text-sm text-slate-600">
            {active} ekor aktif · {quarantine} karantina
          </p>
          <ul className="divide-y divide-slate-100">
            {population.map((row) => (
              <li key={row.species} className="flex min-h-11 items-center justify-between gap-3 py-1 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="flex flex-wrap items-center justify-end gap-1 text-right text-slate-600">
                  <span className="tabular-nums font-semibold text-ink">{row.heads}</span>
                  {row.quarantine > 0 ? <Badge tone="earth">Karantina {row.quarantine}</Badge> : null}
                  {row.sick > 0 ? <Badge tone="red">Sakit {row.sick}</Badge> : null}
                  {row.watch > 0 ? <Badge tone="amber">Pantau {row.watch}</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col">
          <CardTitle>Kohe terkumpul</CardTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-forest-50 px-3 py-3">
              <dt className="text-xs text-forest-900">Hari ini</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{formatWeight(intake.todayKg)}</dd>
            </div>
            <div className="rounded-xl bg-earth-100 px-3 py-3">
              <dt className="text-xs text-earth-900">7 hari</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{formatWeight(intake.weekKg)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tersedia {formatWeight(intake.availableKg)} untuk dikemas. Perkiraan harian {formatWeight(intake.expectedDailyKg)}.
          </p>
          {intake.withheldDailyKg > 0 ? (
            <p className="mt-3 rounded-xl bg-earth-100 px-3 py-3 text-sm leading-6 text-earth-900">
              {formatWeight(intake.withheldDailyKg)} dari {intake.withheldHeads} ekor sakit atau karantina tidak dihitung.
            </p>
          ) : null}
        </Card>
        <Card className="flex flex-col">
          <CardTitle>Bobot hidup</CardTitle>
          {leaders.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada ternak aktif.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {leaders.map((animal) => (
                <li key={animal.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{animal.earTag}</span>
                    <span className="text-xs text-slate-500">{animal.label}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-semibold">{formatWeight(animal.kg)}</span>
                    {animal.heads > 1 ? <span className="text-xs text-slate-500">{animal.heads} ekor</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardSection>
  );
}
