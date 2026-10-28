"use client";

import { useState, type FormEvent } from "react";
import { useStore, useStoreState } from "@/components/providers/store-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { phoneHref } from "@/lib/format";
import type { AgentProfile } from "@/lib/types";

export function ProfileView() {
  const store = useStoreState();
  if (!store.ready) {
    return <p className="text-sm text-slate-500">Menyiapkan data penjualan...</p>;
  }
  return <ProfileForm profile={store.profile} orders={store.orders.length} partners={store.partners.length} />;
}

function ProfileForm({
  profile,
  orders,
  partners,
}: {
  profile: AgentProfile;
  orders: number;
  partners: number;
}) {
  const { updateProfile } = useStore();
  const [draft, setDraft] = useState(profile);
  const [seen, setSeen] = useState(profile);
  const [error, setError] = useState<string | null>(null);

  if (seen !== profile) {
    setSeen(profile);
    setDraft(profile);
  }

  function update(patch: Partial<AgentProfile>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = updateProfile(draft);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardTitle>Identitas lapangan</CardTitle>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama">
              <TextInput value={draft.name} onChange={(event) => update({ name: event.target.value })} />
            </Field>
            <Field label="Peran">
              <TextInput value={draft.role} onChange={(event) => update({ role: event.target.value })} />
            </Field>
            <Field label="Telepon">
              <TextInput
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(event) => update({ phone: event.target.value })}
              />
            </Field>
            <Field label="Wilayah kerja">
              <TextInput value={draft.territory} onChange={(event) => update({ territory: event.target.value })} />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit">Simpan profil</Button>
        </form>
      </Card>
      <div className="space-y-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pesanan di perangkat</p>
          <p className="mt-1 font-display text-3xl text-ink">{orders}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Mitra terdaftar</p>
          <p className="mt-1 font-display text-3xl text-ink">{partners}</p>
        </article>
        <a
          href={phoneHref(profile.phone)}
          className="flex min-h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-forest-800"
        >
          Hubungi {profile.name}
        </a>
      </div>
    </div>
  );
}
