"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { guard } from "@/lib/guard";
import { SPECIES_LABEL } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import {
  CARE_DOSAGE,
  CARE_KINDS,
  CARE_LABEL,
  CARE_STATUS_LABEL,
  MONTH_NAMES,
  completeScheduledTreatment,
  effectiveCareStatus,
  formatScheduleDate,
  scheduleTreatment,
  type CareKind,
  type CareStatus,
  type ScheduledTreatment,
} from "@/lib/medical-schedule";
import type { HealthLog } from "@/lib/health";
import type { MedicalHistoryEntry } from "@/lib/treatment";
import { cn, uid } from "@/lib/utils";

type FilterId = "aktif" | CareStatus;

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "aktif", label: "Jatuh tempo" },
  { id: "OVERDUE", label: "Terlambat" },
  { id: "PENDING", label: "Menunggu" },
  { id: "COMPLETED", label: "Selesai" },
];

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function TreatmentSchedule() {
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const canUpdate = useCan("livestock", "update");
  const [today, setToday] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("aktif");
  const [composer, setComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    setToday(`${now.getFullYear()}-${month}-${day}`);
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  if (!book) return <p className="text-sm text-slate-500">Menyiapkan jadwal pengobatan...</p>;

  const herd = book.animals.filter((animal) => animal.health !== "terjual");
  const rows = (book.scheduledTreatments ?? []).map((item) => ({
    item,
    status: effectiveCareStatus(item, today),
  }));
  const overdue = rows.filter((row) => row.status === "OVERDUE");
  const visible = rows
    .filter((row) => (selectedDay ? row.item.scheduledOn === selectedDay : matchesFilter(row.status, filter)))
    .sort((left, right) => rank(left.status) - rank(right.status) || left.item.scheduledOn.localeCompare(right.item.scheduledOn));

  async function onComplete(item: ScheduledTreatment) {
    setError(null);
    setPendingId(item.id);
    const animal = herd.find((candidate) => candidate.earTag === item.earTag);
    const denied = await guard("livestock", "update", { id: animal?.id ?? item.earTag, health: animal?.health });
    if (denied) {
      setPendingId(null);
      setError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPendingId(null);
      setError("Data kandang belum siap.");
      return;
    }
    const result = completeScheduledTreatment(current, item.id, { logId: uid("hlt"), historyId: uid("riwayat") }, new Date().toISOString());
    if (!result.ok) {
      setPendingId(null);
      setError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPendingId(null);
      setError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    publishVisit(result.treatment, result.log, result.entry);
    setPendingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          {overdue.length} jadwal terlambat. Vaksin, obat cacing, vitamin, dan perawatan dicatat per nomor telinga atau lot. Dosis mengikuti label produk dan dokter hewan.
        </p>
        <Link href="/livestock/health" className={buttonClass("secondary", "shrink-0")}>
          Kesehatan ternak
        </Link>
      </div>
      {overdue.length > 0 ? (
        <section className="rounded-2xl border border-earth-800/20 bg-earth-100 px-4 py-4">
          <h2 className="font-display text-xl text-earth-900">Jatuh tempo</h2>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-earth-900">
            {overdue.map((row) => (
              <li key={row.item.id}>
                {row.item.earTag} · {CARE_LABEL[row.item.kind]} · {formatScheduleDate(row.item.scheduledOn)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Card>
        <CardTitle
          action={
            cursor ? (
              <span className="flex gap-2">
                <Button variant="secondary" onClick={() => setCursor(shiftMonth(cursor, -1))} aria-label="Bulan sebelumnya">
                  Sebelum
                </Button>
                <Button variant="secondary" onClick={() => setCursor(shiftMonth(cursor, 1))} aria-label="Bulan berikutnya">
                  Berikut
                </Button>
              </span>
            ) : null
          }
        >
          {cursor ? `${MONTH_NAMES[cursor.month]} ${cursor.year}` : "Kalender"}
        </CardTitle>
        {cursor ? (
          <MonthGrid
            year={cursor.year}
            month={cursor.month}
            today={today}
            selectedDay={selectedDay}
            rows={rows}
            onSelect={(day) => setSelectedDay((current) => (current === day ? null : day))}
          />
        ) : (
          <p className="text-sm text-slate-500">Menyiapkan kalender...</p>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={!selectedDay && filter === item.id}
            onClick={() => {
              setSelectedDay(null);
              setFilter(item.id);
            }}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              !selectedDay && filter === item.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {selectedDay ? (
        <p className="text-sm text-slate-600">
          Menampilkan {formatScheduleDate(selectedDay)}.{" "}
          <button type="button" className="inline-flex min-h-11 items-center font-semibold text-forest-800" onClick={() => setSelectedDay(null)}>
            Tampilkan semua
          </button>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {canUpdate ? (
        <Card>
          <CardTitle
            action={
              <Button variant="secondary" onClick={() => setComposer((open) => !open)}>
                {composer ? "Tutup" : "Jadwalkan"}
              </Button>
            }
          >
            Jadwal baru
          </CardTitle>
          {composer ? (
            <ScheduleForm
              animals={herd.map((animal) => ({ earTag: animal.earTag, label: `${animal.earTag} · ${SPECIES_LABEL[animal.species]}` }))}
              onError={setError}
              onDone={() => setComposer(false)}
            />
          ) : (
            <p className="text-sm leading-6 text-slate-600">Petugas kandang dapat menambah kunjungan vaksin, obat cacing, vitamin, atau perawatan.</p>
          )}
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Tidak ada jadwal pada saringan ini.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((row) => {
            const animal = herd.find((candidate) => candidate.earTag === row.item.earTag);
            return (
              <li key={row.item.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl text-ink">{row.item.earTag}</p>
                      <p className="text-sm text-slate-500">
                        {animal ? SPECIES_LABEL[animal.species] : "Lot"} · {formatScheduleDate(row.item.scheduledOn)}
                      </p>
                    </div>
                    <Badge tone={row.status === "OVERDUE" ? "earth" : row.status === "COMPLETED" ? "forest" : "amber"}>
                      {CARE_STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink">{CARE_LABEL[row.item.kind]}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{row.item.dosage}</p>
                  <p className="mt-2 text-sm text-slate-600">Petugas {row.item.staffName}</p>
                  {row.item.note ? <p className="mt-1 text-sm text-slate-500">{row.item.note}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {animal ? (
                      <Link href={`/livestock/health/${animal.id}`} className={buttonClass("secondary")}>
                        Rekam kesehatan
                      </Link>
                    ) : null}
                    {canUpdate && row.item.status !== "COMPLETED" ? (
                      <Button disabled={pendingId === row.item.id} onClick={() => void onComplete(row.item)}>
                        {pendingId === row.item.id ? "Menyimpan..." : "Tandai selesai"}
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScheduleForm({
  animals,
  onError,
  onDone,
}: {
  animals: Array<{ earTag: string; label: string }>;
  onError: (message: string | null) => void;
  onDone: () => void;
}) {
  const [earTag, setEarTag] = useState(animals[0]?.earTag ?? "");
  const [kind, setKind] = useState<CareKind>("VACCINATION");
  const [scheduledOn, setScheduledOn] = useState("");
  const [staffName, setStaffName] = useState("");
  const [dosage, setDosage] = useState(CARE_DOSAGE.VACCINATION);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    onError(null);
    const denied = await guard("livestock", "update", { earTag, kind, scheduledOn });
    if (denied) {
      setPending(false);
      onError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      onError("Data kandang belum siap.");
      return;
    }
    const result = scheduleTreatment(current, { earTag, kind, scheduledOn, staffName, dosage, note }, uid("jdw"));
    if (!result.ok) {
      setPending(false);
      onError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPending(false);
      onError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    publishVisit(result.treatment, null, null);
    setPending(false);
    onDone();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nomor telinga / lot">
        <select value={earTag} onChange={(event) => setEarTag(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
          {animals.map((animal) => (
            <option key={animal.earTag} value={animal.earTag}>
              {animal.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Jenis">
        <select
          value={kind}
          onChange={(event) => {
            const next = event.target.value as CareKind;
            setKind(next);
            setDosage(CARE_DOSAGE[next]);
          }}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
        >
          {CARE_KINDS.map((item) => (
            <option key={item} value={item}>
              {CARE_LABEL[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tanggal">
        <TextInput type="date" value={scheduledOn} onChange={(event) => setScheduledOn(event.target.value)} />
      </Field>
      <Field label="Petugas">
        <TextInput value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Nama petugas kandang" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Dosis perencanaan" hint="Ikuti label produk dan dokter hewan. Ini bukan resep.">
          <TextArea value={dosage} onChange={(event) => setDosage(event.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Catatan">
          <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opsional" />
        </Field>
      </div>
      <Button disabled={pending} onClick={() => void onSubmit()}>
        {pending ? "Menyimpan..." : "Simpan jadwal"}
      </Button>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  today,
  selectedDay,
  rows,
  onSelect,
}: {
  year: number;
  month: number;
  today: string | null;
  selectedDay: string | null;
  rows: Array<{ item: ScheduledTreatment; status: CareStatus }>;
  onSelect: (day: string) => void;
}) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [...Array.from({ length: pad }, () => null)];
  for (let day = 1; day <= count; day += 1) cells.push(stamp(year, month, day));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex min-h-11 items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`pad-${index}`} />;
          const marks = rows.filter((row) => row.item.scheduledOn === day);
          const selected = day === selectedDay;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl text-sm",
                selected ? "bg-forest-800 text-white" : "bg-white text-ink",
                !selected && isToday ? "border border-forest-800" : "border border-transparent",
              )}
            >
              <span>{Number(day.slice(8))}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {marks.slice(0, 3).map((mark) => (
                  <span
                    key={mark.item.id}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      selected ? "bg-white" : mark.status === "OVERDUE" ? "bg-earth-800" : mark.status === "COMPLETED" ? "bg-slate-400" : "bg-forest-800",
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function publishVisit(treatment: ScheduledTreatment, log: HealthLog | null, entry: MedicalHistoryEntry | null) {
  void fetch("/api/livestock/treatments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ treatment, log, entry }),
  }).catch(() => undefined);
}

function matchesFilter(status: CareStatus, filter: FilterId) {
  if (filter === "aktif") return status === "OVERDUE" || status === "PENDING";
  return status === filter;
}

function rank(status: CareStatus) {
  if (status === "OVERDUE") return 0;
  if (status === "PENDING") return 1;
  return 2;
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function stamp(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
