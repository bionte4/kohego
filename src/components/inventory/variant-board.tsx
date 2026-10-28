"use client";

import { useState } from "react";
import { useCan } from "@/components/access/role-provider";
import { useStore } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { FAMILIES } from "@/lib/catalog";
import { formatIdr } from "@/lib/format";
import { FAMILY_LABEL, PACKAGE_SIZE_LABEL } from "@/lib/labels";
import { PACKAGE_SIZES, type PackageSize, type Product, type ProductDraft, type ProductFamilyId } from "@/lib/types";

const empty = {
  label: "",
  family: "kambing" as ProductFamilyId,
  packageSize: "5kg" as PackageSize,
  price: "",
  volume: "1",
};

export function VariantBoard() {
  const { products, addProduct, updateProduct, removeProduct } = useStore();
  const canCreate = useCan("catalog", "create");
  const canUpdate = useCan("catalog", "update");
  const canDelete = useCan("catalog", "delete");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [removing, setRemoving] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Kemasan dan varian</CardTitle>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Harga yang sudah tercatat di pesanan tidak berubah. Ukuran dan kategori terkunci jika varian masih punya stok.
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Varian baru
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              {["Nama", "Kategori", "Ukuran", "Harga dasar", ""].map((label) => (
                <th key={label || "aksi"} className="px-3 py-2 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-200">
                <td className="px-3 py-3 font-medium">{product.label}</td>
                <td className="px-3 py-3">{FAMILY_LABEL[product.family]}</td>
                <td className="px-3 py-3">{PACKAGE_SIZE_LABEL[product.packageSize]}</td>
                <td className="px-3 py-3 tabular-nums">{formatIdr(product.priceIdr)}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    {canUpdate ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing(product);
                          setOpen(true);
                        }}
                      >
                        Ubah
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button variant="danger" onClick={() => setRemoving(product)}>
                        Hapus
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <VariantForm
          key={editing?.id ?? "baru"}
          product={editing}
          onClose={() => setOpen(false)}
          onSubmit={async (draft) => {
            const result = editing ? await updateProduct(editing.id, draft) : await addProduct(draft);
            if (!result.ok) return result.message;
            setOpen(false);
            return null;
          }}
        />
      ) : null}
      <Modal open={removing !== null} title={removing ? `Hapus ${removing.label}` : "Hapus varian"} onClose={() => setRemoving(null)}>
        <p className="text-sm leading-6 text-slate-600">Varian dengan stok atau pesanan tetap tersimpan.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!removing) return;
              void removeProduct(removing.id).then((result) => {
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

function VariantForm({
  product,
  onClose,
  onSubmit,
}: {
  product: Product | null;
  onClose: () => void;
  onSubmit: (draft: ProductDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(
    product
      ? {
          label: product.label,
          family: product.family,
          packageSize: product.packageSize,
          price: String(product.priceIdr),
          volume: String(product.volumeL || 1),
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open title={product ? "Ubah varian" : "Varian baru"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            label: draft.label,
            family: draft.family,
            packageSize: draft.packageSize,
            priceIdr: Number.parseInt(draft.price.replace(/[^\d]/g, "") || "0", 10),
            volumeL: Number.parseInt(draft.volume || "1", 10),
          }).then((message) => setError(message));
        }}
      >
        <Field label="Nama varian">
          <TextInput value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
        </Field>
        <ChoiceGroup
          label="Kategori"
          value={draft.family}
          onChange={(family) => setDraft({ ...draft, family })}
          columns="grid-cols-2"
          options={FAMILIES.map((item) => ({ value: item.id, label: item.label }))}
        />
        <Field label="Ukuran kemasan">
          <select
            value={draft.packageSize}
            onChange={(event) => setDraft({ ...draft, packageSize: event.target.value as PackageSize })}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          >
            {PACKAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {PACKAGE_SIZE_LABEL[size]}
              </option>
            ))}
          </select>
        </Field>
        {draft.packageSize === "liter" ? (
          <Field label="Volume (liter)">
            <TextInput
              inputMode="numeric"
              value={draft.volume}
              onChange={(event) => setDraft({ ...draft, volume: event.target.value.replace(/[^\d]/g, "") })}
            />
          </Field>
        ) : null}
        <Field label="Harga dasar (Rp)">
          <TextInput
            inputMode="numeric"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value.replace(/[^\d]/g, "") })}
          />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" className="w-full">
          Simpan varian
        </Button>
      </form>
    </Modal>
  );
}
