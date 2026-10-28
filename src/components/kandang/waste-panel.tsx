"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { productsByFamily, productById } from "@/lib/catalog";
import { formatDate, formatWeight } from "@/lib/format";
import { FAMILY_LABEL, packageUnitLabel } from "@/lib/labels";
import {
  SPECIES_LABEL,
  SPECIES_ORDER,
  SPECIES_PRODUCT_FAMILY,
  WASTE_STATUS_LABEL,
  availableWasteKg,
  conversionVariants,
  expectedDailyManureKg,
  maxPackages,
  type LivestockBook,
  type WasteDraft,
  type WasteOutput,
} from "@/lib/livestock";
import type { VariantId } from "@/lib/types";

export function WastePanel({
  book,
  warehouses,
  onRecord,
  onPack,
}: {
  book: LivestockBook;
  warehouses: { id: string; name: string }[];
  onRecord: (draft: WasteDraft) => Promise<string | null>;
  onPack: (wasteId: string, variant: VariantId, qty: number, warehouseId: string) => Promise<string | null>;
}) {
  const canRecord = useCan("livestock", "create");
  const canPack = useCan("production", "create");
  const [animalId, setAnimalId] = useState(book.animals[0]?.id ?? "");
  const [mass, setMass] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [packing, setPacking] = useState<WasteOutput | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = await onRecord({
      animalId,
      massKg: Number.parseFloat(mass.replace(",", ".")),
      note,
    });
    if (message) {
      setError(message);
      return;
    }
    setMass("");
    setNote("");
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SPECIES_ORDER.map((species) => {
          const family = SPECIES_PRODUCT_FAMILY[species];
          const available = availableWasteKg(book.waste, species);
          const expected = expectedDailyManureKg(book.animals, species);
          const products = family ? productsByFamily(family) : [];
          return (
            <article key={species} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Kohe {SPECIES_LABEL[species]}</p>
              <p className="mt-1 font-display text-2xl text-ink">{formatWeight(available)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Perkiraan harian dari bobot hidup {formatWeight(expected)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                {family
                  ? `Bahan baku ${FAMILY_LABEL[family]}: ${products.map((product) => product.shortLabel).join(", ")}`
                  : "Belum ada SKU pupuk. Tetap dicatat sebagai bahan baku."}
              </p>
            </article>
          );
        })}
      </div>

      <Card>
        <CardTitle
          action={
            <Link href="/inventori" className="text-sm font-medium text-forest-800">
              Stok kemasan
            </Link>
          }
        >
          Catat kohe
        </CardTitle>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Kohe segar dikeringkan lalu masuk gudang sebagai sak atau jerigen. Satu kilogram segar tidak menjadi satu kilogram kemasan.
        </p>
        {canRecord ? (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Asal ternak">
            <select
              value={animalId}
              onChange={(event) => setAnimalId(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              {book.animals
                .filter((animal) => animal.health !== "terjual")
                .map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.earTag} · {SPECIES_LABEL[animal.species]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Massa segar (kg)">
            <TextInput
              inputMode="decimal"
              value={mass}
              onChange={(event) => setMass(event.target.value)}
            />
          </Field>
          <Field label="Catatan" hint="Opsional.">
            <TextArea maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit">Simpan bahan baku</Button>
        </form>
        ) : (
          <p className="text-sm leading-6 text-slate-600">Pencatatan kohe tersedia untuk manajer kandang dan super admin.</p>
        )}
      </Card>

      <Card>
        <CardTitle>Riwayat bahan baku</CardTitle>
        <ul className="space-y-3">
          {book.waste.map((row) => {
            const source = book.animals.find((animal) => animal.id === row.animalId);
            return (
              <li key={row.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {SPECIES_LABEL[row.species]} · {formatWeight(row.massKg)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {source?.earTag ?? "Tanpa tag"} · {formatDate(row.collectedAt)}
                    {row.status === "masuk_produksi"
                      ? row.massKg <= 0
                        ? " · habis"
                        : ` · ${formatWeight(row.massKg)} selesai`
                      : ` · sisa ${formatWeight(row.massKg)}`}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={row.status === "tersedia" ? "earth" : "forest"}>{WASTE_STATUS_LABEL[row.status]}</Badge>
                  {canPack && row.status === "tersedia" && conversionVariants(row.species).some((variant) => maxPackages(row.massKg, row.species, variant) >= 1) ? (
                    <Button variant="secondary" onClick={() => setPacking(row)}>
                      Ke kemasan
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <PackDialog
        row={packing}
        warehouses={warehouses}
        onClose={() => setPacking(null)}
        onPack={async (variant, qty, warehouseId) => {
          if (!packing) return "Catatan kohe tidak ditemukan.";
          const message = await onPack(packing.id, variant, qty, warehouseId);
          setError(message);
          if (!message) setPacking(null);
          return message;
        }}
      />
    </div>
  );
}

function PackDialog({
  row,
  warehouses,
  onClose,
  onPack,
}: {
  row: WasteOutput | null;
  warehouses: { id: string; name: string }[];
  onClose: () => void;
  onPack: (variant: VariantId, qty: number, warehouseId: string) => Promise<string | null>;
}) {
  return (
    <Modal open={row !== null} title="Ke kemasan" onClose={onClose}>
      {row ? <PackForm key={row.id + String(row.massKg)} row={row} warehouses={warehouses} onPack={onPack} /> : null}
    </Modal>
  );
}

function PackForm({
  row,
  warehouses,
  onPack,
}: {
  row: WasteOutput;
  warehouses: { id: string; name: string }[];
  onPack: (variant: VariantId, qty: number, warehouseId: string) => Promise<string | null>;
}) {
  const variants = conversionVariants(row.species).filter((variant) => maxPackages(row.massKg, row.species, variant) >= 1);
  const [variant, setVariant] = useState<VariantId>(variants[0]);
  const cap = maxPackages(row.massKg, row.species, variant);
  const [qty, setQty] = useState(String(Math.max(cap, 1)));
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const product = productById(variant);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onPack(variant, Number.parseInt(qty, 10), warehouseId).then((message) => setError(message));
      }}
    >
      <p className="text-sm leading-6 text-slate-600">
        {SPECIES_LABEL[row.species]} tersisa {formatWeight(row.massKg)}. Hasil kering atau POC dihitung dari massa segar, lalu masuk gudang sebagai{" "}
        {packageUnitLabel(product.unit)}.
      </p>
      <Field label="Kemasan">
        <select
          value={variant}
          onChange={(event) => {
            const next = event.target.value as VariantId;
            setVariant(next);
            setQty(String(Math.max(maxPackages(row.massKg, row.species, next), 1)));
          }}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
        >
          {variants.map((id) => (
            <option key={id} value={id}>
              {productById(id).label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Gudang">
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
      <Field label="Jumlah kemasan" hint={`Paling banyak ${cap}.`}>
        <TextInput inputMode="numeric" value={qty} onChange={(event) => setQty(event.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit">Masukkan ke gudang</Button>
    </form>
  );
}
