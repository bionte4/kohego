"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/field";
import { compostBalance, type CompostBalance } from "@/lib/compost";
import { uid } from "@/lib/utils";

export function CompostView() {
  const [carbon, setCarbon] = useState("30");
  const [nitrogen, setNitrogen] = useState("1");
  const [rawKg, setRawKg] = useState("100");
  const [loss, setLoss] = useState("55");
  const [day, setDay] = useState("3");
  const [celsius, setCelsius] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompostBalance | null>(null);

  function calculate() {
    const value = compostBalance({
      carbonPercent: Number(carbon),
      nitrogenPercent: Number(nitrogen),
      rawKg: Number(rawKg),
      lossPercent: Number(loss),
      readings: [{ day: Number(day), celsius: Number(celsius) }],
    });
    if (!value.ok) {
      setResult(null);
      setError(value.message);
      return;
    }
    setError(null);
    setResult(value.value);
    void fetch("/api/production/compost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: uid("kompos"),
        carbonPercent: Number(carbon),
        nitrogenPercent: Number(nitrogen),
        rawKg: Number(rawKg),
        lossPercent: Number(loss),
        readings: [{ day: Number(day), celsius: Number(celsius) }],
      }),
    });
  }

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        Rasio C:N yang dituju adalah 25–30. Susut massa mengurangi kohe segar menjadi pupuk jadi. Kemasan sak tetap dicatat lewat batch produksi.
      </p>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Karbon %" value={carbon} onChange={setCarbon} />
          <NumberField label="Nitrogen %" value={nitrogen} onChange={setNitrogen} />
          <NumberField label="Kohe segar kg" value={rawKg} onChange={setRawKg} />
          <NumberField label="Susut massa %" value={loss} onChange={setLoss} />
          <NumberField label="Hari ke" value={day} onChange={setDay} />
          <NumberField label="Suhu °C" value={celsius} onChange={setCelsius} />
        </div>
        <Button className="mt-4" onClick={calculate}>Hitung neraca</Button>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      </Card>
      {result ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">Rasio C:N</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-forest-800">{result.ratio}</p>
            <p className="mt-1 text-sm text-slate-600">{result.ratioLabel}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Pupuk jadi</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{result.finishedKg} kg</p>
            <p className="mt-1 text-sm text-slate-600">Rasio konversi {result.conversionRate}</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Suhu</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-earth-800">{result.peakCelsius ?? "—"}°C</p>
            <p className="mt-1 text-sm text-slate-600">{result.curveLabel}</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-medium text-ink">
      {label}
      <input inputMode="decimal" className={`${controlClass} mt-1.5`} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
