"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/access/role-provider";
import { useStoreState } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { buildConsignmentLedger } from "@/lib/consignment";
import { formatIdr } from "@/lib/format";
import { getClientSnapshot, replaceState } from "@/lib/storage";
import type { GeoTag } from "@/lib/types";
import { uid } from "@/lib/utils";

export function ConsignmentView() {
  const store = useStoreState();
  const auth = useAuth();
  const [period, setPeriod] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const clock = new Date();
    setNow(clock);
    const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(clock);
    setPeriod(formatted.slice(0, 7));
  }, []);

  if (!store.ready || !period || !now) return <p className="text-sm text-slate-500">Menyiapkan konsinyasi...</p>;
  const rows = buildConsignmentLedger(store.orders, store.partners, period, now);
  const open = rows.reduce((sum, row) => sum + row.openIdr, 0);
  const credit = rows.reduce((sum, row) => sum + row.suggestedCreditIdr, 0);
  const partner = store.partners.find((item) => item.id === partnerId) ?? store.partners[0];

  function checkIn() {
    if (!partner) return;
    const save = (geo: GeoTag | null) => {
      const current = getClientSnapshot();
      if (!current) return;
      const visit = {
        id: uid("kunj"),
        partnerId: partner.id,
        agentId: auth.user?.id ?? "",
        visitedAt: new Date().toISOString(),
        geo,
        note: note.trim().slice(0, 280),
      };
      replaceState({ ...current, visits: [visit, ...(current.visits ?? [])] });
      setMessage(geo ? "Kunjungan tercatat beserta lokasi." : "Kunjungan tercatat tanpa lokasi.");
      void fetch("/api/reports/consignment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period, sales: current, visit }),
      });
    };
    if (!navigator.geolocation) {
      save(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => save({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy }),
      () => save(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Saldo belum lunas mengikuti nota konsinyasi. Diskon tingkat dihitung dari tonase bulan ini dan tidak mengubah harga nota yang sudah tersimpan.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-slate-500">Piutang konsinyasi</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-earth-800">{formatIdr(open)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Usulan potongan tingkat</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{formatIdr(credit)}</p>
        </Card>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-forest-50 text-forest-950">
            <tr>
              {["Nota", "Mitra", "Jatuh tempo", "Tonase", "Tingkat", "Saldo"].map((label) => (
                <th key={label} className="px-3 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">Tidak ada konsinyasi terbuka pada bulan ini.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.orderId} className="border-t border-slate-100">
                  <td className="px-3 py-3">{row.code}</td>
                  <td className="px-3 py-3">{row.partnerName}</td>
                  <td className="px-3 py-3">{row.dueOn}{row.overdue ? " · lewat" : ""}</td>
                  <td className="px-3 py-3 tabular-nums">{row.volumeKg} kg</td>
                  <td className="px-3 py-3">{row.tier.label} · {Math.round(row.tier.rate * 100)}%</td>
                  <td className="px-3 py-3 tabular-nums">{formatIdr(row.openIdr)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Card>
        <h2 className="font-display text-xl text-ink">Kunjungan lapangan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink">
            Mitra
            <select className={`${controlClass} mt-1.5`} value={partner?.id ?? ""} onChange={(event) => setPartnerId(event.target.value)}>
              {store.partners.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Catatan
            <input className={`${controlClass} mt-1.5`} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <Button className="mt-4" onClick={checkIn}>Catat kunjungan</Button>
        {message ? <p className="mt-3 text-sm text-forest-800">{message}</p> : null}
        <ul className="mt-4 space-y-2">
          {(store.visits ?? []).slice(0, 5).map((visit) => (
            <li key={visit.id} className="text-sm text-slate-600">
              {store.partners.find((item) => item.id === visit.partnerId)?.name ?? visit.partnerId}
              {visit.geo ? ` · ${visit.geo.lat.toFixed(5)}, ${visit.geo.lng.toFixed(5)}` : " · tanpa lokasi"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
