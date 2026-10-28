"use client";

import { useState, useSyncExternalStore } from "react";
import { HerdPanel } from "@/components/kandang/herd-panel";
import { ProductionPanel } from "@/components/kandang/production-panel";
import { WastePanel } from "@/components/kandang/waste-panel";
import { useStoreState } from "@/components/providers/store-provider";
import { productById } from "@/lib/catalog";
import {
  addAnimal,
  issueWaste,
  planWastePack,
  availableWasteKg,
  recordWaste,
  removeAnimal,
  updateAnimal,
  SPECIES_LABEL,
  type AnimalDraft,
  type HealthStatus,
  type LivestockSpecies,
  type WasteDraft,
  type LivestockBook,
} from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import { formatWeight } from "@/lib/format";
import { guard } from "@/lib/guard";
import { packageUnitLabel } from "@/lib/labels";
import { settleProduction } from "@/lib/production";
import type { VariantId } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

type Tab = "ternak" | "bahan" | "produksi";

export function LivestockView() {
  const sales = useStoreState();
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const [tab, setTab] = useState<Tab>("ternak");
  if (!book) {
    return <p className="text-sm text-slate-500">Menyiapkan data kandang...</p>;
  }
  const data = book;

  const active = data.animals.filter((animal) => animal.health !== "terjual");
  const heads = active.reduce((sum, animal) => sum + animal.headcount, 0);
  const sold = data.animals.filter((animal) => animal.health === "terjual").reduce((sum, animal) => sum + animal.headcount, 0);
  const raw = availableWasteKg(data.waste);

  function commit(result: { ok: true; book: LivestockBook } | { ok: false; message: string }) {
    if (!result.ok) return result.message;
    const saved = replaceLivestock(result.book);
    return saved ? null : "Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.";
  }

  async function onAdd(draft: AnimalDraft) {
    const denied = await guard("livestock", "create", draft);
    if (denied) return denied;
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    return commit(addAnimal(current, draft, uid("ani"), new Date().toISOString()));
  }

  async function onUpdate(animalId: string, patch: { weightKg?: number; health?: HealthStatus }) {
    const denied = await guard("livestock", "update", { id: animalId, ...patch });
    if (denied) return denied;
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    return commit(updateAnimal(current, animalId, patch, new Date().toISOString()));
  }

  async function onDelete(animalId: string) {
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    const removed = removeAnimal(current, animalId);
    if (!removed.ok) return removed.message;
    const denied = await guard("livestock", "delete", { id: animalId });
    if (denied) return denied;
    const latest = getLivestockClient();
    if (!latest) return "Data kandang belum siap.";
    return commit(removeAnimal(latest, animalId));
  }

  async function onRecord(draft: WasteDraft) {
    const denied = await guard("livestock", "create", { animalId: draft.animalId, massKg: draft.massKg, note: draft.note });
    if (denied) return denied;
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    return commit(recordWaste(current, draft, uid("wst"), new Date().toISOString()));
  }

  async function onPack(wasteId: string, variant: VariantId, qty: number, warehouseId: string) {
    if (!sales.ready) return "Data gudang belum siap.";
    const denied = await guard("production", "create");
    if (denied) return denied;
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    const row = current.waste.find((item) => item.id === wasteId);
    if (!row) return "Catatan kohe tidak ditemukan.";
    const plan = planWastePack(row, variant, qty);
    if (!plan.ok) return plan.message;
    const issued = issueWaste(current, wasteId, plan.freshKg);
    if (!issued.ok) return issued.message;
    const source = current.animals.find((animal) => animal.id === row.animalId);
    const product = productById(variant);
    const receipt = await sales.receiveStock({
      warehouseId,
      variant,
      qty,
      breederName: source?.earTag ?? "Kandang",
      note: `Konversi ${plan.freshKg.toFixed(1)} kg kohe segar menjadi ${qty} ${packageUnitLabel(product.unit)} ${product.shortLabel}.`,
    });
    if (!receipt.ok) return receipt.message;
    const latest = getLivestockClient();
    if (!latest) return "Data kandang belum siap.";
    const savedIssue = issueWaste(latest, wasteId, plan.freshKg);
    if (!savedIssue.ok) return savedIssue.message;
    return commit(savedIssue);
  }

  async function onProduce(input: {
    species: LivestockSpecies;
    rawKg: number;
    conversionRate: number;
    variantId: VariantId;
    warehouseId: string;
  }) {
    if (!sales.ready) return "Data gudang belum siap.";
    const denied = await guard("production", "create");
    if (denied) return denied;
    const current = getLivestockClient();
    if (!current) return "Data kandang belum siap.";
    const id = uid("batch");
    const nowIso = new Date().toISOString();
    const settled = settleProduction(current, { ...input, id, nowIso });
    if (!settled.ok) return settled.message;
    const product = productById(input.variantId);
    const receipt = await sales.receiveStock({
      warehouseId: input.warehouseId,
      variant: input.variantId,
      qty: settled.estimate.packages,
      breederName: `Kohe ${SPECIES_LABEL[input.species]}`,
      note: `Batch ${settled.estimate.rawKg} kg × ${settled.estimate.conversionRate} menjadi ${settled.estimate.packages} ${packageUnitLabel(product.unit)} ${product.shortLabel}.`,
    });
    if (!receipt.ok) return receipt.message;
    const latest = getLivestockClient();
    if (!latest) return "Data kandang belum siap.";
    const savedBatch = settleProduction(latest, { ...input, id, nowIso });
    if (!savedBatch.ok) return savedBatch.message;
    const saved = commit(savedBatch);
    if (!saved) {
      void fetch("/api/production", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          id,
          species: input.species,
          rawKg: input.rawKg,
          conversionRate: input.conversionRate,
          variantId: input.variantId,
        }),
      }).catch(() => undefined);
    }
    return saved;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        {heads} ekor di kandang{sold > 0 ? `, ${sold} ekor terjual` : ""}. {formatWeight(raw)} kohe segar masih bisa dikemas ke stok pupuk.
      </p>
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "ternak"} onClick={() => setTab("ternak")}>
          Ternak
        </TabButton>
        <TabButton active={tab === "bahan"} onClick={() => setTab("bahan")}>
          Bahan baku
        </TabButton>
        <TabButton active={tab === "produksi"} onClick={() => setTab("produksi")}>
          Produksi & konversi
        </TabButton>
      </div>
      {tab === "ternak" ? <HerdPanel book={data} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} /> : null}
      {tab === "bahan" ? (
        <WastePanel
          book={data}
          warehouses={sales.ready ? sales.warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name })) : []}
          onRecord={onRecord}
          onPack={onPack}
        />
      ) : null}
      {tab === "produksi" ? (
        <ProductionPanel
          book={data}
          warehouses={sales.ready ? sales.warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name })) : []}
          onComplete={onProduce}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-4 text-sm font-medium",
        active ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
      )}
    >
      {children}
    </button>
  );
}
