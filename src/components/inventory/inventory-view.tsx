"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useStore, useStoreState } from "@/components/providers/store-provider";
import { useCan } from "@/components/access/role-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { QtyStepper } from "@/components/ui/qty-stepper";
import { Badge } from "@/components/ui/badge";
import { OpnameForm } from "@/components/inventory/opname-form";
import { VariantBoard } from "@/components/inventory/variant-board";
import { WarehouseBoard } from "@/components/inventory/warehouse-board";
import { FAMILIES, lowStockLimit, productById, productsByFamily } from "@/lib/catalog";
import { formatDateTime, formatVolume, formatWeight } from "@/lib/format";
import { MOVEMENT_LABEL, packageUnitLabel, warehouseKindLabel } from "@/lib/labels";
import { stockKilograms, stockLiters, stockQty } from "@/lib/stock";
import type { ProductFamilyId, VariantId, Warehouse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "stok" | "opname" | "masuk" | "kirim" | "gudang" | "kemasan" | "riwayat";

export function InventoryView() {
  const store = useStoreState();
  const canCreate = useCan("inventory", "create");
  const canUpdate = useCan("inventory", "update");
  const [tab, setTab] = useState<Tab>("stok");
  if (!store.ready) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }
  const lowCount = store.stock.filter((line) => {
    const product = store.products.find((item) => item.id === line.variant);
    return product ? line.qty < lowStockLimit(product) : false;
  }).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "stok", label: lowCount > 0 ? `Stok (${lowCount} menipis)` : "Stok" },
    ...(canUpdate ? [{ id: "opname" as const, label: "Opname" }] : []),
    ...(canCreate ? [{ id: "masuk" as const, label: "Masuk" }] : []),
    ...(canUpdate ? [{ id: "kirim" as const, label: "Kirim" }] : []),
    { id: "gudang", label: "Gudang" },
    { id: "kemasan", label: "Kemasan" },
    { id: "riwayat", label: "Riwayat" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        On-hand {formatWeight(stockKilograms(store.stock, undefined, store.products))} padat dan {formatVolume(stockLiters(store.stock, undefined, store.products))} POC di{" "}
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
      {tab === "opname" && canUpdate ? <OpnameForm /> : null}
      {tab === "masuk" && canCreate ? <ReceiptForm /> : null}
      {tab === "kirim" && canUpdate ? <TransferForm /> : null}
      {tab === "gudang" ? <WarehouseBoard /> : null}
      {tab === "kemasan" ? <VariantBoard /> : null}
      {tab === "riwayat" ? <MovementLog /> : null}
    </div>
  );
}

function StockBoard() {
  const { warehouses, stock, products, writeOffStock, adjustOpname } = useStore();
  const canCreate = useCan("inventory", "create");
  const canUpdate = useCan("inventory", "update");
  const canDelete = useCan("inventory", "delete");
  const [family, setFamily] = useState<ProductFamilyId | "all">("all");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ warehouseId: string; variant: VariantId } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = family === "all" ? products : productsByFamily(family, products);
  const rows = warehouses.flatMap((warehouse) => visible.map((product) => ({ warehouse, product, qty: stockQty(stock, warehouse.id, product.id) })));

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Ubah mengisi hasil hitung. Hapus mengeluarkan seluruh jumlah di baris itu.</p>
        {canCreate ? <Button onClick={() => setAdding(true)}>Stok masuk</Button> : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-forest-50 text-forest-950">
            <tr>
              {["Gudang", "Varian", "Jumlah", "Kondisi", ""].map((label) => (
                <th key={label || "aksi"} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ warehouse, product, qty }) => {
              const low = qty < lowStockLimit(product);
              const unit = packageUnitLabel(product.unit);
              const key = `${warehouse.id}:${product.id}`;
              return (
                <tr key={key} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-xs text-slate-500">{warehouseKindLabel(warehouse.kind)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{product.label}</p>
                    <p className="text-xs text-slate-500">{product.role}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {qty} {unit}
                    <span className="block text-xs text-slate-500">
                      {product.volumeL > 0 ? formatVolume(qty * product.volumeL) : formatWeight(qty * product.weightKg)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={low ? "earth" : "forest"}>{low ? "Menipis" : "Aman"}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canUpdate ? (
                        <Button variant="secondary" onClick={() => setEditing({ warehouseId: warehouse.id, variant: product.id })}>
                          Ubah
                        </Button>
                      ) : null}
                      {canDelete && qty > 0 ? (
                        pendingKey === key ? (
                          <>
                            <Button
                              variant="danger"
                              onClick={() => {
                                void writeOffStock({ warehouseId: warehouse.id, variant: product.id, qty }).then((result) => {
                                  setError(result.ok ? null : result.message);
                                  if (result.ok) setPendingKey(null);
                                });
                              }}
                            >
                              Ya, hapus
                            </Button>
                            <Button variant="secondary" onClick={() => setPendingKey(null)}>
                              Batal
                            </Button>
                          </>
                        ) : (
                          <Button variant="danger" onClick={() => setPendingKey(key)}>
                            Hapus
                          </Button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adding ? <ReceiptModal onClose={() => setAdding(false)} /> : null}
      {editing ? (
        <CountModal
          key={`${editing.warehouseId}:${editing.variant}`}
          warehouseName={warehouses.find((item) => item.id === editing.warehouseId)?.name ?? "Gudang"}
          productLabel={products.find((item) => item.id === editing.variant)?.label ?? editing.variant}
          unit={packageUnitLabel(products.find((item) => item.id === editing.variant)?.unit ?? "sak")}
          onHand={stockQty(stock, editing.warehouseId, editing.variant)}
          onClose={() => setEditing(null)}
          onSave={async (countedQty) => {
            const result = await adjustOpname({ ...editing, countedQty });
            if (!result.ok) return result.message;
            setEditing(null);
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function CountModal({
  warehouseName,
  productLabel,
  unit,
  onHand,
  onClose,
  onSave,
}: {
  warehouseName: string;
  productLabel: string;
  unit: string;
  onHand: number;
  onClose: () => void;
  onSave: (countedQty: number) => Promise<string | null>;
}) {
  const [counted, setCounted] = useState(String(onHand));
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open title={`Ubah ${productLabel}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(Number.parseInt(counted, 10)).then((message) => setError(message));
        }}
      >
        <p className="text-sm leading-6 text-slate-600">
          {warehouseName}. Tercatat {onHand} {unit}. Isi jumlah hasil hitung.
        </p>
        <Field label="Jumlah hitung">
          <TextInput inputMode="numeric" value={counted} onChange={(event) => setCounted(event.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Simpan jumlah</Button>
      </form>
    </Modal>
  );
}

function ReceiptModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open title="Stok masuk" onClose={onClose}>
      <ReceiptForm onDone={onClose} />
    </Modal>
  );
}

function ReceiptForm({ onDone }: { onDone?: () => void }) {
  const { warehouses, products, receiveStock } = useStore();
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
    onDone?.();
  }

  const form = (
      <form onSubmit={onSubmit} className="space-y-5">
        <ChoiceGroup
          label="Gudang tujuan"
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
        />
        <VariantChoices value={variant} onChange={setVariant} />
        <Field label={`Jumlah ${packageUnitLabel(productById(variant, products).unit)}`}>
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
  );
  if (onDone) return form;
  return (
    <Card>
      <CardTitle>Catat masuk dari peternak</CardTitle>
      {form}
    </Card>
  );
}

function TransferForm() {
  const { warehouses, products, stock, transferStock } = useStore();
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
          label={`Jumlah ${packageUnitLabel(productById(variant, products).unit)}`}
          hint={`Stok asal ${productById(variant, products).label}: ${onHand} ${packageUnitLabel(productById(variant, products).unit)}.`}
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
  const { products } = useStore();
  const family = productById(value, products).family;
  const sizes = productsByFamily(family, products);

  return (
    <>
      <ChoiceGroup
        label="Produk"
        value={family}
        onChange={(next) => {
          const first = productsByFamily(next, products)[0];
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
  const { movements, warehouses, products } = useStore();
  const rows = useMemo(() => movements.slice(0, 40), [movements]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada pergerakan.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((movement) => {
        const product = products.find((item) => item.id === movement.variant);
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
