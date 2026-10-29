"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { feedConversion, recordFeed, recordWeight, setLineage } from "@/lib/lineage";
import { assignRfid, STAGE_LABEL, type LifeStage } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import { activeHolds } from "@/lib/withdrawal";
import { uid } from "@/lib/utils";

export function LineageView() {
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const canUpdate = useCan("livestock", "update");
  const [animalId, setAnimalId] = useState("");
  const [stage, setStage] = useState<LifeStage>("dewasa");
  const [sireTag, setSireTag] = useState("");
  const [damTag, setDamTag] = useState("");
  const [weighedOn, setWeighedOn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [fedOn, setFedOn] = useState("");
  const [feedKg, setFeedKg] = useState("");
  const [rfid, setRfid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nowIso, setNowIso] = useState<string | null>(null);

  useEffect(() => {
    setNowIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    const herd = book?.animals.filter((animal) => animal.health !== "terjual") ?? [];
    const selected = herd.find((animal) => animal.id === animalId) ?? herd[0];
    setRfid(selected?.rfid ?? "");
  }, [book, animalId]);

  if (!book) return <p className="text-sm text-slate-500">Menyiapkan silsilah...</p>;
  const herd = book.animals.filter((animal) => animal.health !== "terjual");
  const selected = herd.find((animal) => animal.id === animalId) ?? herd[0];

  function saveLineage() {
    if (!book || !selected) return;
    const result = setLineage(book, selected.id, { stage, sireTag, damTag });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    replaceLivestock(result.book);
    void fetch("/api/livestock/lineage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: `lin-${selected.earTag}`, earTag: selected.earTag, sireTag, damTag, stage }),
    });
  }

  function saveWeight() {
    if (!book || !selected) return;
    const result = recordWeight(book, selected.earTag, weighedOn, Number(weightKg), uid("wgt"));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    replaceLivestock(result.book);
  }

  function saveRfid() {
    if (!book || !selected) return;
    const result = assignRfid(book, selected.id, rfid, new Date().toISOString());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    replaceLivestock(result.book);
    const tag = rfid.trim();
    if (!tag) return;
    void fetch("/api/livestock/registry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ earTag: selected.earTag, rfid: tag }),
    });
  }

  function saveFeed() {
    if (!book || !selected) return;
    const result = recordFeed(book, selected.earTag, fedOn, Number(feedKg), uid("fed"));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    replaceLivestock(result.book);
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Tahap hidup berjalan dari Pedet ke Dewasa lalu Afkir. FCR adalah kilogram pakan dibagi kenaikan bobot hidup di antara dua timbangan.
      </p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {herd.map((animal) => {
          const ratio = feedConversion(animal, book.weightChecks ?? [], book.feedLogs ?? []);
          const holds = nowIso ? activeHolds((book.treatmentCases ?? []).filter((item) => item.earTag === animal.earTag).flatMap((item) => item.doses), nowIso) : [];
          return (
            <li key={animal.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl text-ink">{animal.earTag}</h2>
                  <Badge tone="earth">{STAGE_LABEL[animal.stage]}</Badge>
                  {holds.length > 0 ? <Badge tone="red">Henti obat</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Induk {animal.damTag ?? "—"} · Pejantan {animal.sireTag ?? "—"}
                </p>
                <p className="mt-1 text-sm text-slate-600">RFID {animal.rfid || "belum terpasang"}</p>
                <p className="mt-1 text-sm text-slate-600">{ratio.detail}</p>
              </Card>
            </li>
          );
        })}
      </ul>
      {canUpdate && selected ? (
        <Card>
          <h2 className="font-display text-xl text-ink">Catat silsilah dan pakan</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink">
              Ternak
              <select className={`${controlClass} mt-1.5`} value={selected.id} onChange={(event) => setAnimalId(event.target.value)}>
                {herd.map((animal) => (
                  <option key={animal.id} value={animal.id}>{animal.earTag}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink">
              Tahap
              <select className={`${controlClass} mt-1.5`} value={stage} onChange={(event) => setStage(event.target.value as LifeStage)}>
                <option value="pedet">Pedet</option>
                <option value="dewasa">Dewasa</option>
                <option value="culling">Afkir</option>
              </select>
            </label>
            <label className="text-sm font-medium text-ink">
              Nomor pejantan
              <input className={`${controlClass} mt-1.5`} value={sireTag} onChange={(event) => setSireTag(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-ink">
              Nomor induk
              <input className={`${controlClass} mt-1.5`} value={damTag} onChange={(event) => setDamTag(event.target.value)} />
            </label>
          </div>
          <Button className="mt-4" onClick={saveLineage}>Simpan silsilah</Button>
          <label className="mt-4 block text-sm font-medium text-ink">
            RFID 15 digit
            <input inputMode="numeric" className={`${controlClass} mt-1.5`} value={rfid} onChange={(event) => setRfid(event.target.value)} />
          </label>
          <Button className="mt-4" variant="secondary" onClick={saveRfid}>Simpan RFID</Button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink">
              Tanggal timbang
              <input type="date" className={`${controlClass} mt-1.5`} value={weighedOn} onChange={(event) => setWeighedOn(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-ink">
              Bobot kg
              <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-ink">
              Tanggal pakan
              <input type="date" className={`${controlClass} mt-1.5`} value={fedOn} onChange={(event) => setFedOn(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-ink">
              Pakan kg
              <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={feedKg} onChange={(event) => setFeedKg(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveWeight}>Catat bobot</Button>
            <Button variant="secondary" onClick={saveFeed}>Catat pakan</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
