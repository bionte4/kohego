"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth, useCan } from "@/components/access/role-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { guard } from "@/lib/guard";
import { SYMPTOM_CODES, SYMPTOM_LABEL, TEMP_BAND, type SymptomCode } from "@/lib/health";
import { saveDailyInspection, type InspectionRowDraft } from "@/lib/inspection";
import { SPECIES_LABEL } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import { cn, uid } from "@/lib/utils";

function blankRows(animalIds: string[]): InspectionRowDraft[] {
  return animalIds.map((animalId) => ({
    animalId,
    temperatureC: "",
    activityLevel: "70",
    symptoms: [],
    feedKg: "",
    manureKg: "",
  }));
}

export function InspectionView() {
  const auth = useAuth();
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const canUpdate = useCan("livestock", "update");
  const [penId, setPenId] = useState("");
  const [inspectedOn, setInspectedOn] = useState<string | null>(null);
  const [waterOk, setWaterOk] = useState(true);
  const [floorDry, setFloorDry] = useState(true);
  const [feedFresh, setFeedFresh] = useState(true);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<InspectionRowDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    setInspectedOn(formatted);
  }, []);

  useEffect(() => {
    if (!book || penId) return;
    const first = book.pens[0];
    if (!first) return;
    const animals = book.animals.filter((animal) => animal.penId === first.id && animal.health !== "terjual");
    setPenId(first.id);
    setRows(blankRows(animals.map((animal) => animal.id)));
  }, [book, penId]);

  if (!auth.ready || !book || !inspectedOn) {
    return <p className="text-sm text-slate-500">Menyiapkan inspeksi...</p>;
  }

  const pen = book.pens.find((item) => item.id === penId) ?? book.pens[0];
  const animals = book.animals.filter((animal) => animal.penId === pen?.id && animal.health !== "terjual");
  const saved = (book.inspections ?? []).filter((item) => item.inspectedOn === inspectedOn);

  function choosePen(nextPenId: string) {
    if (!book) return;
    const herd = book.animals.filter((animal) => animal.penId === nextPenId && animal.health !== "terjual");
    setPenId(nextPenId);
    setRows(blankRows(herd.map((animal) => animal.id)));
    setError(null);
    setNotice(null);
  }

  function patchRow(animalId: string, patch: Partial<InspectionRowDraft>) {
    setRows((current) => current.map((row) => (row.animalId === animalId ? { ...row, ...patch } : row)));
  }

  function toggleSymptom(animalId: string, code: SymptomCode) {
    setRows((current) =>
      current.map((row) => {
        if (row.animalId !== animalId) return row;
        const symptoms = row.symptoms.includes(code) ? row.symptoms.filter((item) => item !== code) : [...row.symptoms, code];
        return { ...row, symptoms };
      }),
    );
  }

  async function onSave() {
    if (!book || !pen || !inspectedOn) return;
    setPending(true);
    const sample = animals[0];
    const denied = await guard("livestock", "update", sample ? { id: sample.id, health: sample.health } : undefined);
    if (denied) {
      setPending(false);
      setError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      setError("Data kandang belum siap.");
      return;
    }
    const result = saveDailyInspection(
      current,
      {
        penId: pen.id,
        inspectedOn,
        waterOk,
        floorDry,
        feedFresh,
        note,
        recordedBy: auth.user?.id ?? "",
        rows,
      },
      uid("ins"),
      new Date().toISOString(),
      {
        health: (earTag) => uid(`hlt-${earTag}`),
        feed: (earTag) => uid(`fed-${earTag}`),
        waste: (earTag) => uid(`wst-${earTag}`),
      },
    );
    if (!result.ok) {
      setPending(false);
      setNotice(null);
      setError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPending(false);
      setError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    setPending(false);
    setError(null);
    setNotice(`Inspeksi ${pen.name} tersimpan.`);
    setRows(blankRows(animals.map((animal) => animal.id)));
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Isi sekali setiap putaran kandang. Suhu yang diisi masuk ke kesehatan ternak. Pakan masuk ke silsilah. Kohe yang masih dalam henti obat tidak bisa dikumpulkan.
      </p>
      {canUpdate ? (
        <Card>
          <CardTitle>Putaran kandang</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink">
              Kandang
              <select className={`${controlClass} mt-1.5`} value={pen?.id ?? ""} onChange={(event) => choosePen(event.target.value)}>
                {book.pens.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink">
              Tanggal
              <input type="date" className={`${controlClass} mt-1.5`} value={inspectedOn} onChange={(event) => setInspectedOn(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <CheckButton pressed={waterOk} onClick={() => setWaterOk((value) => !value)} label="Air minum terisi" />
            <CheckButton pressed={floorDry} onClick={() => setFloorDry((value) => !value)} label="Lantai kering" />
            <CheckButton pressed={feedFresh} onClick={() => setFeedFresh((value) => !value)} label="Pakan tidak basi" />
          </div>
          <ul className="mt-4 space-y-3">
            {animals.map((animal) => {
              const row = rows.find((item) => item.animalId === animal.id) ?? blankRows([animal.id])[0];
              const band = TEMP_BAND[animal.species];
              return (
                <li key={animal.id} className="rounded-2xl border border-slate-200 p-3">
                  <p className="font-medium text-ink">{animal.earTag}</p>
                  <p className="text-sm text-slate-500">{SPECIES_LABEL[animal.species]} · suhu biasa {band.min}–{band.max}°C</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-ink">
                      Suhu °C
                      <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={row.temperatureC} onChange={(event) => patchRow(animal.id, { temperatureC: event.target.value })} />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Aktivitas 0–100
                      <input inputMode="numeric" className={`${controlClass} mt-1.5`} value={row.activityLevel} onChange={(event) => patchRow(animal.id, { activityLevel: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })} />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Pakan kg
                      <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={row.feedKg} onChange={(event) => patchRow(animal.id, { feedKg: event.target.value })} />
                    </label>
                    <label className="text-sm font-medium text-ink">
                      Kohe kg
                      <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={row.manureKg} onChange={(event) => patchRow(animal.id, { manureKg: event.target.value })} />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SYMPTOM_CODES.map((code) => {
                      const active = row.symptoms.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleSymptom(animal.id, code)}
                          className={cn(
                            "min-h-11 rounded-full px-4 text-sm font-medium",
                            active ? "bg-earth-800 text-white" : "border border-slate-300 bg-white text-ink",
                          )}
                        >
                          {SYMPTOM_LABEL[code]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
          <label className="mt-4 block text-sm font-medium text-ink">
            Catatan
            <textarea maxLength={280} className={`${controlClass} mt-1.5 min-h-24 py-3`} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
          {notice ? <p role="status" className="mt-3 text-sm text-forest-800">{notice}</p> : null}
          <Button className="mt-4" disabled={pending} onClick={onSave}>{pending ? "Menyimpan..." : "Simpan inspeksi"}</Button>
        </Card>
      ) : (
        <p className="text-sm leading-6 text-slate-600">Inspeksi harian diisi oleh petugas kandang, manajer kandang, atau super admin.</p>
      )}
      <Card>
        <CardTitle>Tersimpan tanggal ini</CardTitle>
        {saved.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada inspeksi pada tanggal ini.</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((item) => {
              const place = book.pens.find((entry) => entry.id === item.penId);
              const flags = [item.waterOk ? "air ada" : "air kosong", item.floorDry ? "lantai kering" : "lantai basah", item.feedFresh ? "pakan baik" : "pakan basi"];
              return (
                <li key={item.id} className="rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-600">
                  <p className="font-medium text-ink">{place?.name ?? item.penId}</p>
                  <p>{flags.join(" · ")}</p>
                  {item.animals.some((animal) => animal.temperatureC !== null || animal.feedKg !== null || animal.manureKg !== null) ? (
                    <p>{item.animals.map((animal) => animal.earTag).join(", ")}</p>
                  ) : null}
                  {item.note ? <p>{item.note}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CheckButton({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-4 text-sm font-medium",
        pressed ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
      )}
    >
      {label}
    </button>
  );
}
