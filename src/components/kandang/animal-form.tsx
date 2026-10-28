"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SPECIES_LABEL, SPECIES_ORDER, type AnimalDraft, type AnimalGender, type HealthStatus, type LivestockBook, type LivestockSpecies } from "@/lib/livestock";

const empty = {
  earTag: "",
  species: "kambing" as LivestockSpecies,
  breed: "",
  gender: "betina" as AnimalGender,
  birthDate: "",
  penId: "",
  weight: "",
  headcount: "1",
  health: "sehat" as HealthStatus,
  note: "",
};

export function AnimalForm({
  book,
  open,
  onClose,
  onSave,
}: {
  book: LivestockBook;
  open: boolean;
  onClose: () => void;
  onSave: (draft: AnimalDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const pens = book.pens.filter((pen) => pen.species === draft.species);
  const penId = pens.some((pen) => pen.id === draft.penId) ? draft.penId : (pens[0]?.id ?? "");
  const flock = draft.species === "ayam" || draft.species === "bebek";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = await onSave({
      earTag: draft.earTag,
      species: draft.species,
      breed: draft.breed,
      gender: draft.gender,
      birthDate: draft.birthDate,
      penId,
      weightKg: Number.parseFloat(draft.weight.replace(",", ".")),
      headcount: flock ? Number.parseInt(draft.headcount, 10) : 1,
      health: draft.health,
      note: draft.note,
    });
    if (message) {
      setError(message);
      return;
    }
    setDraft(empty);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Ternak baru"
      onClose={() => {
        setError(null);
        onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-4">
        <ChoiceGroup
          label="Jenis"
          value={draft.species}
          onChange={(species) => setDraft((current) => ({ ...current, species, penId: "" }))}
          columns="grid-cols-2"
          options={SPECIES_ORDER.map((species) => ({ value: species, label: SPECIES_LABEL[species] }))}
        />
        <Field label="Nomor telinga" hint="Unik. Untuk lot ayam atau bebek, pakai kode lot.">
          <TextInput
            value={draft.earTag}
            onChange={(event) => setDraft((current) => ({ ...current, earTag: event.target.value }))}
            autoComplete="off"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ras" hint="Contoh: Limousin, Etawa, ISA Brown.">
            <TextInput
              value={draft.breed}
              onChange={(event) => setDraft((current) => ({ ...current, breed: event.target.value }))}
            />
          </Field>
          <Field label="Tanggal lahir">
            <TextInput
              type="date"
              value={draft.birthDate}
              onChange={(event) => setDraft((current) => ({ ...current, birthDate: event.target.value }))}
            />
          </Field>
        </div>
        <ChoiceGroup
          label="Kelamin"
          value={draft.gender}
          onChange={(gender) => setDraft((current) => ({ ...current, gender }))}
          columns="grid-cols-3"
          options={[
            { value: "jantan", label: "Jantan" },
            { value: "betina", label: "Betina" },
            { value: "campuran", label: "Campuran" },
          ]}
        />
        <ChoiceGroup
          label="Kandang"
          value={penId}
          onChange={(next) => setDraft((current) => ({ ...current, penId: next }))}
          options={pens.map((pen) => ({ value: pen.id, label: pen.name, hint: pen.location }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bobot hidup (kg)" hint={flock ? "Rata-rata per ekor." : "Per ekor."}>
            <TextInput
              inputMode="decimal"
              value={draft.weight}
              onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value }))}
            />
          </Field>
          <Field label="Jumlah ekor" hint={flock ? "Lot boleh lebih dari satu." : "Satu nomor, satu ekor."}>
            <TextInput
              inputMode="numeric"
              disabled={!flock}
              value={flock ? draft.headcount : "1"}
              onChange={(event) => setDraft((current) => ({ ...current, headcount: event.target.value }))}
            />
          </Field>
        </div>
        <ChoiceGroup
          label="Kesehatan"
          value={draft.health}
          onChange={(health) => setDraft((current) => ({ ...current, health }))}
          columns="grid-cols-2"
          options={[
            { value: "sehat", label: "Sehat" },
            { value: "pantau", label: "Pantau" },
            { value: "sakit", label: "Sakit" },
            { value: "karantina", label: "Karantina" },
            { value: "terjual", label: "Terjual" },
          ]}
        />
        <Field label="Catatan" hint="Opsional.">
          <TextArea
            maxLength={280}
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit">Simpan ternak</Button>
      </form>
    </Modal>
  );
}
