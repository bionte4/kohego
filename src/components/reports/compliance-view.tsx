"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardLink, CardTitle } from "@/components/ui/card";
import { complianceSnapshot } from "@/lib/compliance";
import { STAGE_LABEL } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, subscribeLivestock } from "@/lib/livestock-store";
import type { Role } from "@/lib/rbac";

const ALLOWED: Role[] = ["SUPER_ADMIN", "FARM_MANAGER", "FARM_KEEPER", "WAREHOUSE_ADMIN"];

export function ComplianceView() {
  const auth = useAuth();
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const [nowIso, setNowIso] = useState<string | null>(null);

  useEffect(() => {
    setNowIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!auth.ready || !auth.role || !ALLOWED.includes(auth.role)) return;
    void fetch("/api/reports/compliance").catch(() => undefined);
  }, [auth.ready, auth.role]);

  if (!auth.ready || !book || !nowIso) {
    return <p className="text-sm text-slate-500">Menyiapkan kepatuhan...</p>;
  }
  if (!auth.role || !ALLOWED.includes(auth.role)) {
    return <p className="text-sm text-slate-600">Kepatuhan kandang tersedia untuk petugas kandang, manajer kandang, admin gudang, dan super admin.</p>;
  }

  const report = complianceSnapshot(book, nowIso);
  const live = book.animals.filter((animal) => animal.health !== "terjual").length;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Daftar periksa kandang untuk karantina, henti obat, dan mutu kompos. Ini bukan diagnosis dokter hewan dan bukan resep. Batas residu mengikuti label produk. Aplikasi tidak menghitung mg/kg.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Zona karantina</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-earth-800">{report.zones.length}</p>
          <p className="mt-1 text-sm text-slate-600">Kandang dengan ternak sakit atau karantina</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Henti obat aktif</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{report.holds.length}</p>
          <p className="mt-1 text-sm text-slate-600">Susu, daging, dan kohe terkunci</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">RFID terpasang</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{report.registeredRfid}/{live}</p>
          <p className="mt-1 text-sm text-slate-600">15 digit, format ISO 11784</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Target kompos</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{report.compost.cnMin}–{report.compost.cnMax}</p>
          <p className="mt-1 text-sm text-slate-600">C:N, suhu {report.compost.thermophilicMinC}–{report.compost.thermophilicMaxC}°C</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Zona karantina</CardTitle>
        {report.zones.length === 0 ? (
          <p className="text-sm text-slate-600">Tidak ada ternak sakit atau karantina.</p>
        ) : (
          <ul className="space-y-3">
            {report.zones.map((zone) => (
              <li key={zone.penName} className="rounded-xl bg-earth-50 px-3 py-3">
                <p className="font-medium text-earth-900">{zone.penName}</p>
                <p className="text-sm text-earth-900/80">{zone.location}</p>
                <ul className="mt-2 space-y-1">
                  {zone.animals.map((animal) => (
                    <li key={animal.id} className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{animal.earTag}</span>
                      <Badge tone={animal.health === "karantina" ? "amber" : "red"}>{animal.health}</Badge>
                      <span className="text-slate-600">{STAGE_LABEL[animal.stage]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Henti obat</CardTitle>
        {report.holds.length === 0 ? (
          <p className="text-sm text-slate-600">Tidak ada jendela henti obat yang masih berjalan.</p>
        ) : (
          <ul className="space-y-3">
            {report.holds.map((hold) => (
              <li key={`${hold.earTag}-${hold.medicineName}`} className="rounded-xl border border-slate-200 px-3 py-3">
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{hold.earTag}</span>
                  <Badge tone="red">Sampai {hold.until}</Badge>
                </div>
                <p className="text-sm text-slate-600">{hold.penName} · {hold.medicineName}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{hold.residueNote}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle action={<CardLink href="/livestock/lineage">Isi RFID</CardLink>}>Identifikasi</CardTitle>
        {report.missingRfid.length === 0 ? (
          <p className="text-sm text-slate-600">Semua ternak hidup sudah punya RFID 15 digit.</p>
        ) : (
          <p className="text-sm leading-6 text-slate-600">
            Belum terpasang: {report.missingRfid.map((animal) => animal.earTag).join(", ")}.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle action={<CardLink href="/produksi/kimia">Hitung neraca</CardLink>}>Acuan obat dan kompos</CardTitle>
        <ul className="space-y-3">
          {report.standards.map((item) => (
            <li key={item.id} className="text-sm leading-6 text-slate-600">
              <span className="font-medium text-ink">{item.medicineName}</span>
              {" · "}
              {item.species === "semua" ? "semua spesies" : item.species}
              {". Hari henti diisi dari label. Selama jendela itu, susu, daging, dan kohe terkunci."}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Kompos dituju pada C:N {report.compost.cnMin}:1 sampai {report.compost.cnMax}:1. Fase termofilik dihitung bila suhu {report.compost.thermophilicMinC}–{report.compost.thermophilicMaxC}°C tercatat minimal {report.compost.thermophilicDays} kali. Sak gudang tetap lewat batch produksi.
        </p>
      </Card>
    </div>
  );
}
