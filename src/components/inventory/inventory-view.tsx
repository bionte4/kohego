"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useStore, useStoreState } from "@/components/providers/store-provider";
import { useCan } from "@/components/access/role-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { Badge } from "@/components/ui/badge";
import { FAMILIES, PAR_LEVEL, PRODUCTS, lowStockLimit, productById, productsByFamily } from "@/lib/catalog";
import { formatDateTime, formatVolume, formatWeight } from "@/lib/format";
import { MOVEMENT_LABEL, packageUnitLabel, warehouseKindLabel } from "@/lib/labels";
import { stockKilograms, stockLiters, stockQty } from "@/lib/stock";
import type { ProductFamilyId, VariantId, Warehouse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "stok" | "masuk" | "kirim" | "riwayat";

export function InventoryView() {
  const store = useStoreState();
  const canCreate = useCan("inventory", "create");
  const canUpdate = useCan("inventory", "update");
  const [tab, setTab] = useState<Tab>("stok");
  if (!store.ready) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }
  const lowCount = store.stock.filter((line) => {
    const product = PRODUCTS.find((item) => item.id === line.variant);
    return product ? line.qty < lowStockLimit(product) : false;
  }).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "stok", label: lowCount > 0 ? `Stok (${lowCount} menipis)` : "Stok" },
    ...(canCreate ? [{ id: "masuk" as const, label: "Masuk" }] : []),
    ...(canUpdate ? [{ id: "kirim" as const, label: "Kirim" }] : []),
    { id: "riwayat", label: "Riwayat" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        On-hand {formatWeight(stockKilograms(store.stock))} padat dan {formatVolume(stockLiters(store.stock))} POC di{" "}
        {store.warehouses.length} lokasi. Sak di bawah 20 dan jerigen di bawah 8 ditandai menipis. Kohe segar dikemas lewat{" "}
        <Link href="/kandang" className="font-medium text-forest-800">
          Produksi & konversi
        </Link>
        .
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
              tab === item.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "stok" ? <StockBoard /> : null}
      {tab === "masuk" && canCreate ? <ReceiptForm /> : null}
      {tab === "kirim" && canUpdate ? <TransferForm /> : null}
      {tab === "riwayat" ? <MovementLog /> : null}
    </div>
  );
}

function StockBoard() {
  const { warehouses, stock, writeOffStock } = useStore();
  const canDelete = useCan("inventory", "delete");
  const [family, setFamily] = useState<ProductFamilyId | "all">("all");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const products = family === "all" ? PRODUCTS : productsByFamily(family);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={family === "all"}
          onClick={() => setFamily("all")}
          className={cn(
            "min-h-11 rounded-full px-4 text-sm font-medium",
            family === "all" ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
          )}
        >
          Semua
        </button>
        {FAMILIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={family === item.id}
            onClick={() => setFamily(item.id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              family === item.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-ink">{warehouse.name}</h2>
                <p className="text-sm text-slate-500">
                  {warehouse.city} · {formatWeight(stockKilograms(stock, warehouse.id))} ·{" "}
                  {formatVolume(stockLiters(stock, warehouse.id))}
                </p>
              </div>
              <Badge tone={warehouse.kind === "gudang" ? "forest" : "earth"}>
                {warehouseKindLabel(warehouse.kind)}
              </Badge>
            </div>
            <ul className="space-y-3">
              {products.map((product) => {
                const qty = stockQty(stock, warehouse.id, product.id);
                const low = qty < lowStockLimit(product);
                const width = Math.min(100, (qty / PAR_LEVEL[product.id]) * 100);
                const unit = packageUnitLabel(product.unit);
                return (
                  <li key={product.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 font-medium">
                        {product.label}
                        <span className="ml-2 text-xs font-normal text-slate-500">{product.role}</span>
                      </span>
                      <span className={cn("shrink-0 tabular-nums", low ? "font-semibold text-earth-800" : "text-slate-600")}>
                        {qty} {unit}
                        {low ? " · menipis" : ""}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={cn("h-2 rounded-full", low ? "bg-earth-700" : "bg-forest-800")}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {product.volumeL > 0 ? formatVolume(qty * product.volumeL) : formatWeight(qty * product.weightKg)}
                    </p>
                    {canDelete && qty > 0 ? (
                      pendingKey === `${warehouse.id}:${product.id}` ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            variant="danger"
                            onClick={() => {
                              void writeOffStock({ warehouseId: warehouse.id, variant: product.id, qty }).then((result) => {
                                setError(result.ok ? null : result.message);
                                if (result.ok) setPendingKey(null);
                              });
                            }}
                          >
                            Ya, hapus {qty} {unit}
                          </Button>
                          <Button variant="secondary" onClick={() => setPendingKey(null)}>
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <Button variant="danger" className="mt-2" onClick={() => setPendingKey(`${warehouse.id}:${product.id}`)}>
                          Hapus
                        </Button>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReceiptForm() {
  const { warehouses, receiveStock } = useStore();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [variant, setVariant] = useState<VariantId>("kambing-25");
  const [qty, setQty] = useState(1);
  const [breederName, setBreederName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await receiveStock({ warehouseId, variant, qty, breederName, note });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setBreederName("");
    setNote("");
    setQty(1);
  }

  return (
    <Card>
      <CardTitle>Catat masuk dari peternak</CardTitle>
      <form onSubmit={onSubmit} className="space-y-5">
        <ChoiceGroup
          label="Gudang tujuan"
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
        />
        <VariantChoices value={variant} onChange={setVariant} />
        <Field label={`Jumlah ${packageUnitLabel(productById(variant).unit)}`}>
          <QtyStepper label="stok masuk" value={qty} onChange={setQty} />
        </Field>
        <Field label="Sumber stok" hint="Peternak atau dapur produksi.">
          <TextInput
            value={breederName}
            onChange={(event) => setBreederName(event.target.value)}
            placeholder="Nama peternak atau dapur"
          />
        </Field>
        <Field label="Catatan" hint="Opsional. Misalnya nomor batch.">
          <TextArea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Catat stok masuk</Button>
      </form>
    </Card>
  );
}

function TransferForm() {
  const { warehouses, stock, transferStock } = useStore();
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? "");
  const [variant, setVariant] = useState<VariantId>("kambing-25");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onHand = stockQty(stock, fromWarehouseId, variant);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await transferStock({ fromWarehouseId, toWarehouseId, variant, qty, note });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setNote("");
    setQty(1);
  }

  return (
    <Card>
      <CardTitle>Catat kiriman antar gudang</CardTitle>
      <form onSubmit={onSubmit} className="space-y-5">
        <ChoiceGroup
          label="Dari"
          value={fromWarehouseId}
          onChange={setFromWarehouseId}
          options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
        />
        <ChoiceGroup
          label="Ke"
          value={toWarehouseId}
          onChange={setToWarehouseId}
          options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
        />
        <VariantChoices value={variant} onChange={setVariant} />
        <Field
          label={`Jumlah ${packageUnitLabel(productById(variant).unit)}`}
          hint={`Stok asal ${productById(variant).label}: ${onHand} ${packageUnitLabel(productById(variant).unit)}.`}
        >
          <QtyStepper label="kiriman" value={qty} onChange={setQty} />
        </Field>
        <Field label="Catatan" hint="Opsional.">
          <TextArea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Catat kiriman</Button>
      </form>
    </Card>
  );
}

function VariantChoices({
  value,
  onChange,
}: {
  value: VariantId;
  onChange: (value: VariantId) => void;
}) {
  const family = productById(value).family;
  const sizes = productsByFamily(family);

  return (
    <>
      <ChoiceGroup
        label="Produk"
        value={family}
        onChange={(next) => {
          const first = productsByFamily(next)[0];
          if (first) onChange(first.id);
        }}
        columns="grid-cols-2"
        options={FAMILIES.map((item) => ({ value: item.id, label: item.label, hint: item.blurb }))}
      />
      <ChoiceGroup
        label="Kemasan"
        value={value}
        onChange={onChange}
        columns="grid-cols-2 sm:grid-cols-3"
        options={sizes.map((product) => ({
          value: product.id,
          label: product.shortLabel,
          hint: product.role,
        }))}
      />
    </>
  );
}

function MovementLog() {
  const { movements, warehouses } = useStore();
  const rows = useMemo(() => movements.slice(0, 40), [movements]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada pergerakan.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((movement) => {
        const product = PRODUCTS.find((item) => item.id === movement.variant);
        const sign = movement.kind === "masuk" ? "+" : movement.kind === "kirim" ? "" : "−";
        return (
          <li key={movement.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {MOVEMENT_LABEL[movement.kind]} · {product?.label ?? movement.variant}
                </p>
                <p className="text-sm text-slate-600">{routeLabel(warehouses, movement.warehouseId, movement.toWarehouseId)}</p>
                {movement.breederName ? <p className="text-sm text-slate-600">{movement.breederName}</p> : null}
                {movement.note ? <p className="text-xs text-slate-500">{movement.note}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {sign}
                  {movement.qty} {product ? packageUnitLabel(product.unit) : "kemasan"}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(movement.createdAt)}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function routeLabel(warehouses: Warehouse[], fromId: string, toId?: string) {
  const from = warehouses.find((warehouse) => warehouse.id === fromId)?.name ?? "Gudang";
  if (!toId) return from;
  const to = warehouses.find((warehouse) => warehouse.id === toId)?.name ?? "Gudang";
  return `${from} → ${to}`;
}
