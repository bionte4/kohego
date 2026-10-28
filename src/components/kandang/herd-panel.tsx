"use client";

import { useState } from "react";
import { AnimalForm } from "@/components/kandang/animal-form";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatWeight } from "@/lib/format";
import {
  GENDER_LABEL,
  HEALTH_LABEL,
  SPECIES_LABEL,
  SPECIES_ORDER,
  liveWeightKg,
  type Animal,
  type AnimalDraft,
  type HealthStatus,
  type LivestockBook,
  type LivestockSpecies,
  type PenDraft,
} from "@/lib/livestock";
import { cn } from "@/lib/utils";

function healthTone(health: HealthStatus) {
  if (health === "sehat") return "forest" as const;
  if (health === "pantau") return "amber" as const;
  if (health === "sakit" || health === "karantina") return "earth" as const;
  return "slate" as const;
}

export function HerdPanel({
  book,
  onAdd,
  onAddPen,
  onReplace,
  onUpdate,
  onDelete,
}: {
  book: LivestockBook;
  onAdd: (draft: AnimalDraft) => Promise<string | null>;
  onAddPen: (draft: PenDraft) => Promise<string | null>;
  onReplace: (animalId: string, draft: AnimalDraft) => Promise<string | null>;
  onUpdate: (animalId: string, patch: { weightKg?: number; health?: HealthStatus }) => Promise<string | null>;
  onDelete: (animalId: string) => Promise<string | null>;
}) {
  const canCreate = useCan("livestock", "create");
  const canUpdate = useCan("livestock", "update");
  const canDelete = useCan("livestock", "delete");
  const [species, setSpecies] = useState<LivestockSpecies | "all">("all");
  const [health, setHealth] = useState<HealthStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [penOpen, setPenOpen] = useState(false);
  const [revising, setRevising] = useState<Animal | null>(null);
  const [editing, setEditing] = useState<Animal | null>(null);
  const [removing, setRemoving] = useState<Animal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = book.animals.filter((animal) => {
    if (species !== "all" && animal.species !== species) return false;
    if (health !== "all" && animal.health !== health) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={species === "all"} onClick={() => setSpecies("all")}>
            Semua
          </FilterChip>
          {SPECIES_ORDER.map((item) => (
            <FilterChip key={item} active={species === item} onClick={() => setSpecies(item)}>
              {SPECIES_LABEL[item]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-40">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Kesehatan</span>
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value as HealthStatus | "all")}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="all">Semua status</option>
              {(Object.keys(HEALTH_LABEL) as HealthStatus[]).map((status) => (
                <option key={status} value={status}>
                  {HEALTH_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          {canCreate ? (
            <Button variant="secondary" onClick={() => setPenOpen(true)}>
              Kandang baru
            </Button>
          ) : null}
          {canCreate ? <Button onClick={() => setOpen(true)}>Ternak baru</Button> : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-forest-50 text-forest-950">
            <tr>
              {["Telinga", "Jenis", "Ras", "Kelamin", "Lahir", "Bobot", "Ekor", "Kesehatan", "Kandang", ""].map((label) => (
                <th key={label || "aksi"} className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((animal) => {
              const pen = book.pens.find((item) => item.id === animal.penId);
              return (
                <tr key={animal.id} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-semibold">{animal.earTag}</td>
                  <td className="px-3 py-3">{SPECIES_LABEL[animal.species]}</td>
                  <td className="px-3 py-3">{animal.breed}</td>
                  <td className="px-3 py-3">{GENDER_LABEL[animal.gender]}</td>
                  <td className="px-3 py-3">{formatDate(`${animal.birthDate}T12:00:00.000Z`)}</td>
                  <td className="px-3 py-3">
                    {formatWeight(animal.weightKg)}
                    {animal.headcount > 1 ? <span className="block text-xs text-slate-500">Hidup {formatWeight(liveWeightKg(animal))}</span> : null}
                  </td>
                  <td className="px-3 py-3">{animal.headcount}</td>
                  <td className="px-3 py-3">
                    <Badge tone={healthTone(animal.health)}>{HEALTH_LABEL[animal.health]}</Badge>
                  </td>
                  <td className="px-3 py-3">{pen?.name ?? animal.penId}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? (
                        <Button variant="secondary" onClick={() => setRevising(animal)}>
                          Ubah
                        </Button>
                      ) : null}
                      {canUpdate ? (
                        <Button variant="secondary" onClick={() => setEditing(animal)}>
                          Bobot
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button variant="danger" onClick={() => setRemoving(animal)}>
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
      {visible.length === 0 ? <p className="text-sm text-slate-500">Belum ada ternak pada filter ini.</p> : null}
      <AnimalForm book={book} open={open} onClose={() => setOpen(false)} onSave={onAdd} />
      <PenForm
        open={penOpen}
        onClose={() => setPenOpen(false)}
        onSave={async (draft) => {
          const message = await onAddPen(draft);
          setError(message);
          if (!message) setPenOpen(false);
          return message;
        }}
      />
      {revising ? (
        <AnimalForm
          key={revising.id}
          book={book}
          animal={revising}
          open
          onClose={() => setRevising(null)}
          onSave={(draft) => onReplace(revising.id, draft)}
        />
      ) : null}
      <WeightDialog
        animal={editing}
        onClose={() => setEditing(null)}
        onSave={async (animalId, patch) => {
          const message = await onUpdate(animalId, patch);
          setError(message);
          if (!message) setEditing(null);
          return message;
        }}
      />
      <Modal open={removing !== null} title={removing ? `Hapus ${removing.earTag}` : "Hapus ternak"} onClose={() => setRemoving(null)}>
        {removing ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              {removing.earTag} akan keluar dari daftar kandang. Kohe yang masih tersedia menahan penghapusan.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  void onDelete(removing.id).then((message) => {
                    setError(message);
                    if (!message) setRemoving(null);
                  });
                }}
              >
                Ya, hapus
              </Button>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function WeightDialog({
  animal,
  onClose,
  onSave,
}: {
  animal: Animal | null;
  onClose: () => void;
  onSave: (animalId: string, patch: { weightKg: number; health: HealthStatus }) => Promise<string | null>;
}) {
  return (
    <Modal open={animal !== null} title={animal ? `Bobot ${animal.earTag}` : "Bobot"} onClose={onClose}>
      {animal ? <WeightForm key={animal.updatedAt} animal={animal} onSave={onSave} /> : null}
    </Modal>
  );
}

function WeightForm({
  animal,
  onSave,
}: {
  animal: Animal;
  onSave: (animalId: string, patch: { weightKg: number; health: HealthStatus }) => Promise<string | null>;
}) {
  const [weight, setWeight] = useState(String(animal.weightKg));
  const [health, setHealth] = useState<HealthStatus>(animal.health);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(animal.id, {
          weightKg: Number.parseFloat(weight.replace(",", ".")),
          health,
        }).then((message) => setError(message));
      }}
    >
      <Field label="Bobot per ekor (kg)" hint={animal.headcount > 1 ? "Rata-rata pada lot ini." : "Bobot hidup saat ini."}>
        <TextInput inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
      </Field>
      <Field label="Kesehatan">
        <select
          value={health}
          onChange={(event) => setHealth(event.target.value as HealthStatus)}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
        >
          {(Object.keys(HEALTH_LABEL) as HealthStatus[]).map((status) => (
            <option key={status} value={status}>
              {HEALTH_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit">Simpan bobot</Button>
    </form>
  );
}

function PenForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: PenDraft) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<LivestockSpecies>("kambing");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} title="Kandang baru" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            name,
            species,
            location,
            capacity: Number.parseInt(capacity, 10),
          }).then((message) => setError(message));
        }}
      >
        <Field label="Nama kandang">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <ChoiceGroup
          label="Jenis ternak"
          value={species}
          onChange={setSpecies}
          columns="grid-cols-2"
          options={SPECIES_ORDER.map((item) => ({ value: item, label: SPECIES_LABEL[item] }))}
        />
        <Field label="Lokasi">
          <TextInput value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field label="Kapasitas (ekor)">
          <TextInput
            inputMode="numeric"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Simpan kandang</Button>
      </form>
    </Modal>
  );
}

function FilterChip({
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
