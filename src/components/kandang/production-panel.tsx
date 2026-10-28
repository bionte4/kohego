"use client";

import { useState } from "react";
import { useCan } from "@/components/access/role-provider";
import { useStoreState } from "@/components/providers/store-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { PRODUCTS, productById } from "@/lib/catalog";
import { formatDateTime, formatWeight } from "@/lib/format";
import { packageUnitLabel } from "@/lib/labels";
import {
  SPECIES_LABEL,
  SPECIES_ORDER,
  availableWasteKg,
  conversionVariants,
  type LivestockBook,
  type LivestockSpecies,
} from "@/lib/livestock";
import { estimateProduction, packageMeasure, suggestedRate } from "@/lib/production";
import type { VariantId } from "@/lib/types";

export function ProductionPanel({
  book,
  warehouses,
  onComplete,
}: {
  book: LivestockBook;
  warehouses: { id: string; name: string }[];
  onComplete: (input: {
    species: LivestockSpecies;
    rawKg: number;
    conversionRate: number;
    variantId: VariantId;
    warehouseId: string;
  }) => Promise<string | null>;
}) {
  const canComplete = useCan("production", "create");
  const sales = useStoreState();
  const catalog = sales.ready ? sales.products : PRODUCTS;
  const [species, setSpecies] = useState<LivestockSpecies>("kambing");
  const variants = conversionVariants(species, catalog);
  const [variantId, setVariantId] = useState<VariantId>(variants[0]);
  const [rate, setRate] = useState(String(suggestedRate("kambing", variants[0])));
  const [raw, setRaw] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const available = availableWasteKg(book.waste, species);
  const measure = packageMeasure(variantId, catalog);
  const rawKg = Number.parseFloat(raw.replace(",", "."));
  const conversionRate = Number.parseFloat(rate.replace(",", "."));
  const estimate =
    measure && Number.isFinite(rawKg) && Number.isFinite(conversionRate)
      ? estimateProduction(rawKg, conversionRate, measure.size, measure.unit)
      : null;
  const ready = estimate && !("ok" in estimate) && estimate.packages >= 1;

  function chooseSpecies(next: LivestockSpecies) {
    const options = conversionVariants(next, catalog);
    const variant = options[0];
    setSpecies(next);
    setVariantId(variant);
    setRate(String(suggestedRate(next, variant, catalog)));
  }

  function chooseVariant(next: VariantId) {
    setVariantId(next);
    setRate(String(suggestedRate(species, next, catalog)));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Produksi & konversi</CardTitle>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Kemasan utuh = (bobot segar × rasio) / ukuran kemasan, dibulatkan ke bawah. Sisa hasil ditampilkan sebelum batch ditutup.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canComplete) return;
            void onComplete({
              species,
              rawKg,
              conversionRate,
              variantId,
              warehouseId,
            }).then((message) => {
              setError(message);
              if (!message) setRaw("");
            });
          }}
        >
          <Field label="Jenis kohe" hint={`Tersedia ${formatWeight(available)}. Tertua dipakai lebih dulu.`}>
            <select
              value={species}
              onChange={(event) => chooseSpecies(event.target.value as LivestockSpecies)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              {SPECIES_ORDER.map((item) => (
                <option key={item} value={item}>
                  {SPECIES_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bobot segar (kg)">
              <TextInput inputMode="decimal" value={raw} onChange={(event) => setRaw(event.target.value)} />
            </Field>
            <Field label="Rasio konversi" hint="0,80 berarti 80% bobot segar menjadi hasil jadi.">
              <TextInput inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
            </Field>
          </div>
          <Field label="Varian jadi">
            <select
              value={variantId}
              onChange={(event) => chooseVariant(event.target.value as VariantId)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              {variants.map((id) => (
                <option key={id} value={id}>
                  {productById(id, catalog).label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gudang tujuan">
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </Field>
          <Estimate estimate={estimate} label={measure?.shortLabel ?? ""} unitName={measure ? packageUnitLabel(measure.unitName) : ""} />
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {canComplete ? (
            <Button type="submit" disabled={!ready || warehouses.length === 0}>
              Selesaikan batch
            </Button>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Menutup batch tersedia untuk admin gudang dan super admin.</p>
          )}
        </form>
      </Card>
      <Card>
        <CardTitle>Batch selesai</CardTitle>
        {(book.batches ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada batch. Kohe yang dikonversi akan tercatat di sini.</p>
        ) : (
          <ul className="space-y-3">
            {book.batches.map((batch) => {
              const product = productById(batch.variantId, catalog);
              return (
                <li key={batch.id} className="rounded-2xl border border-slate-200 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">
                      {SPECIES_LABEL[batch.species]} · {formatWeight(batch.rawKg)} × {batch.conversionRate}
                    </p>
                    <Badge tone="forest">Selesai</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {batch.outputUnits} {packageUnitLabel(product.unit)} {product.shortLabel} · {formatDateTime(batch.completedAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Estimate({
  estimate,
  label,
  unitName,
}: {
  estimate: ReturnType<typeof estimateProduction> | null;
  label: string;
  unitName: string;
}) {
  if (!estimate) {
    return <p className="rounded-2xl bg-earth-50 px-4 py-3 text-sm text-earth-900">Isi bobot dan rasio untuk melihat hasil.</p>;
  }
  if ("ok" in estimate) {
    return <p className="rounded-2xl bg-earth-50 px-4 py-3 text-sm text-earth-900">{estimate.message}</p>;
  }
  const finished = estimate.unit === "L" ? `${formatNumber(estimate.finished)} L` : formatWeight(estimate.finished);
  const unpacked = estimate.unit === "L" ? `${formatNumber(estimate.unpacked)} L` : formatWeight(estimate.unpacked);
  return (
    <div className="rounded-2xl bg-forest-50 px-4 py-3 text-sm leading-6 text-forest-950">
      <p>
        {formatWeight(estimate.rawKg)} × {formatNumber(estimate.conversionRate)} = {finished} hasil.
      </p>
      <p>
        {estimate.packages} {unitName} {label}. {estimate.unpacked > 0 ? `Sisa ${unpacked} belum mengisi satu kemasan.` : "Tidak ada sisa kemasan."}
      </p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}
