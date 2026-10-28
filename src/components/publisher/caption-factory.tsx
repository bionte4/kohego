"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextArea } from "@/components/ui/field";
import { PLATFORM_CAPABILITIES, type CaptionSubject, type SocialPlatform } from "@/lib/publisher";
import { cn } from "@/lib/utils";

export function CaptionFactory({
  subjects,
  subjectKey,
  caption,
  platforms,
  when,
  busy,
  error,
  onSubject,
  onCaption,
  onToggle,
  onResetCaption,
  onWhen,
  onSaveDraft,
  onSchedule,
  onPublish,
}: {
  subjects: CaptionSubject[];
  subjectKey: string;
  caption: string;
  platforms: SocialPlatform[];
  when: string;
  busy: boolean;
  error: string | null;
  onSubject: (key: string) => void;
  onCaption: (caption: string) => void;
  onToggle: (platform: SocialPlatform) => void;
  onResetCaption: () => void;
  onWhen: (value: string) => void;
  onSaveDraft: () => void;
  onSchedule: () => void;
  onPublish: () => void;
}) {
  const products = subjects.filter((item) => item.kind === "produk");
  const animals = subjects.filter((item) => item.kind === "ternak");

  function saveDraft(event: FormEvent) {
    event.preventDefault();
    onSaveDraft();
  }

  return (
    <Card>
      <CardTitle>Content Factory</CardTitle>
      <form onSubmit={saveDraft} className="space-y-4">
        <Field label="Produk atau ternak">
          <select
            value={subjectKey}
            onChange={(event) => onSubject(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          >
            <optgroup label="Pupuk">
              {products.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </optgroup>
            {animals.length > 0 ? (
              <optgroup label="Ternak">
                {animals.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Platform</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_CAPABILITIES.map((item) => {
              const on = platforms.includes(item.platform);
              return (
                <button
                  key={item.platform}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(item.platform)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-left text-sm font-medium",
                    on ? "border-forest-800 bg-forest-50 text-forest-900" : "border-slate-300 bg-white text-ink",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Naskah" hint="Bobot, harga, dan stok diisi dari inventori atau ternak. Tombol di bawah menulis ulang naskah itu.">
          <TextArea value={caption} maxLength={2200} onChange={(event) => onCaption(event.target.value)} />
        </Field>
        <button type="button" className="min-h-11 text-sm font-medium text-forest-800" onClick={onResetCaption}>
          Buat naskah otomatis
        </button>

        <Field label="Jadwal" hint="Kosongkan jika ingin draf atau terbit sekarang.">
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => onWhen(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" variant="secondary" disabled={busy}>
            Simpan draf
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onSchedule}>
            Jadwalkan
          </Button>
          <Button type="button" disabled={busy} onClick={onPublish}>
            {busy ? "Mengirim..." : "Terbitkan sekarang"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
