"use client";

import { useState } from "react";
import { useCan } from "@/components/access/role-provider";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { warehouseKindLabel } from "@/lib/labels";
import { occupancy } from "@/lib/stock";
import type { Warehouse, WarehouseDraft } from "@/lib/types";

const empty = { name: "", location: "", capacity: "500", pic: "", kind: "gudang" as const };

export function WarehouseBoard() {
  const { warehouses, stock, addWarehouse, updateWarehouse, removeWarehouse } = useStore();
  const canCreate = useCan("sites", "create");
  const canUpdate = useCan("sites", "update");
  const canDelete = useCan("sites", "delete");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [removing, setRemoving] = useState<Warehouse | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Gudang asal</CardTitle>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Lokasi, kapasitas kemasan, dan penanggung jawab. Perubahan gudang tersedia untuk manajer kandang dan super admin.
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Gudang baru
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              {["Nama", "Lokasi", "Kapasitas", "Terisi", "PIC", ""].map((label) => (
                <th key={label || "aksi"} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warehouses.map((warehouse) => {
              const filled = occupancy(stock, warehouse.id);
              return (
                <tr key={warehouse.id} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <p className="font-medium">{warehouse.name}</p>
                    <p className="text-xs text-slate-500">{warehouseKindLabel(warehouse.kind)}</p>
                  </td>
                  <td className="px-3 py-3">{warehouse.location}</td>
                  <td className="px-3 py-3 tabular-nums">{warehouse.capacity}</td>
                  <td className="px-3 py-3 tabular-nums">{filled}</td>
                  <td className="px-3 py-3">{warehouse.pic}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {canUpdate ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditing(warehouse);
                            setOpen(true);
                          }}
                        >
                          Ubah
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="danger" onClick={() => setRemoving(warehouse)}>
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open ? (
        <WarehouseForm
          key={editing?.id ?? "baru"}
          warehouse={editing}
          onClose={() => setOpen(false)}
          onSubmit={async (draft) => {
            const result = editing ? await updateWarehouse(editing.id, draft) : await addWarehouse(draft);
            if (!result.ok) return result.message;
            setOpen(false);
            return null;
          }}
        />
      ) : null}
      <Modal open={removing !== null} title={removing ? `Hapus ${removing.name}` : "Hapus gudang"} onClose={() => setRemoving(null)}>
        <p className="text-sm leading-6 text-slate-600">Gudang yang masih menyimpan stok atau tercatat di pesanan tidak bisa dihapus.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!removing) return;
              void removeWarehouse(removing.id).then((result) => {
                if (result.ok) {
                  setRemoving(null);
                  setError(null);
                } else setError(result.message);
              });
            }}
          >
            Ya, hapus
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function WarehouseForm({
  warehouse,
  onClose,
  onSubmit,
}: {
  warehouse: Warehouse | null;
  onClose: () => void;
  onSubmit: (draft: WarehouseDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(
    warehouse
      ? {
          name: warehouse.name,
          location: warehouse.location,
          capacity: String(warehouse.capacity),
          pic: warehouse.pic,
          kind: warehouse.kind,
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open title={warehouse ? "Ubah gudang" : "Gudang baru"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            name: draft.name,
            location: draft.location,
            capacity: Number.parseInt(draft.capacity, 10),
            pic: draft.pic,
            kind: draft.kind,
          }).then((message) => setError(message));
        }}
      >
        <Field label="Nama gudang">
          <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field label="Lokasi">
          <TextInput value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kapasitas (kemasan)">
            <TextInput
              inputMode="numeric"
              value={draft.capacity}
              onChange={(event) => setDraft({ ...draft, capacity: event.target.value.replace(/[^\d]/g, "") })}
            />
          </Field>
          <Field label="Penanggung jawab">
            <TextInput value={draft.pic} onChange={(event) => setDraft({ ...draft, pic: event.target.value })} />
          </Field>
        </div>
        <ChoiceGroup
          label="Jenis"
          value={draft.kind}
          onChange={(kind) => setDraft({ ...draft, kind })}
          options={[
            { value: "gudang", label: "Gudang" },
            { value: "agen", label: "Agen" },
          ]}
        />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full">
          Simpan gudang
        </Button>
      </form>
    </Modal>
  );
}
