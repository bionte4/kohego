"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { packageUnitLabel } from "@/lib/labels";
import { stockQty } from "@/lib/stock";
import type { VariantId } from "@/lib/types";

export function OpnameForm() {
  const { warehouses, products, stock, adjustOpname } = useStore();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [variant, setVariant] = useState<VariantId>(products[0]?.id ?? "");
  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const product = products.find((item) => item.id === variant) ?? products[0];
  const onHand = product ? stockQty(stock, warehouseId, product.id) : 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    const result = await adjustOpname({
      warehouseId,
      variant: product.id,
      countedQty: Number.parseInt(counted, 10),
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setCounted("");
  }

  return (
    <Card>
      <CardTitle>Opname stok</CardTitle>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Isi jumlah kemasan yang dihitung di gudang. Selisih dicatat sebagai masuk atau koreksi. Konversi kohe menjadi kemasan tetap lewat{" "}
        <Link href="/kandang" className="font-medium text-forest-800">
          Produksi & konversi
        </Link>
        .
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
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
        <Field label="Varian">
          <select
            value={product?.id ?? ""}
            onChange={(event) => setVariant(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          >
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Jumlah hitung"
          hint={product ? `Tercatat ${onHand} ${packageUnitLabel(product.unit)}.` : "Belum ada varian."}
        >
          <TextInput
            inputMode="numeric"
            value={counted}
            placeholder={String(onHand)}
            onChange={(event) => setCounted(event.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Simpan opname</Button>
      </form>
    </Card>
  );
}
