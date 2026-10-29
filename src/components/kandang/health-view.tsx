"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/format";
import { guard } from "@/lib/guard";
import {
  CHECK_LABEL,
  CHECK_STATUSES,
  latestHealthLog,
  recordHealthCheck,
  RISK_LABEL,
  setHerdHealth,
  SYMPTOM_CODES,
  SYMPTOM_LABEL,
  TEMP_BAND,
  herdStatusForCheck,
  type HealthCheckStatus,
  type HealthLog,
  type HealthRiskLevel,
  type SymptomCode,
} from "@/lib/health";
import { SPECIES_LABEL, type Animal, type HealthStatus } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import { cn, uid } from "@/lib/utils";

type FilterId = "perhatian" | HealthCheckStatus;

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "perhatian", label: "Perlu perhatian" },
  { id: "QUARANTINE", label: "Karantina" },
  { id: "SICK", label: "Sakit" },
  { id: "OBSERVATION", label: "Pantau" },
  { id: "HEALTHY", label: "Sehat" },
];

const HEALTH_RANK: Record<HealthStatus, number> = {
  sakit: 0,
  karantina: 1,
  pantau: 2,
  sehat: 3,
  terjual: 4,
};

export function HealthView() {
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const canUpdate = useCan("livestock", "update");
  const [filter, setFilter] = useState<FilterId>("perhatian");
  const [checking, setChecking] = useState<Animal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!book) return <p className="text-sm text-slate-500">Menyiapkan data kesehatan...</p>;

  const herd = book.animals.filter((animal) => animal.health !== "terjual");
  const attention = herd.filter((animal) => animal.health === "sakit" || animal.health === "karantina" || animal.health === "pantau");
  const visible = herd
    .filter((animal) => matchesFilter(animal.health, filter))
    .sort((left, right) => HEALTH_RANK[left.health] - HEALTH_RANK[right.health] || left.earTag.localeCompare(right.earTag));

  async function commitStatus(animal: Animal, status: HealthCheckStatus) {
    setError(null);
    setPendingId(animal.id);
    const denied = await guard("livestock", "update", { id: animal.id, health: herdStatusForCheck(status) });
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
    const checkedAt = new Date().toISOString();
    const result = setHerdHealth(current, animal.id, status, uid("hlt"), checkedAt);
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
    void publishLog(result.log, animal.species);
    setPendingId(null);
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        {attention.length} ternak perlu perhatian. Skor dihitung dari suhu, aktivitas, dan gejala. Ini simulasi untuk petugas kandang, bukan diagnosis dokter hewan.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Karantina" value={herd.filter((animal) => animal.health === "karantina").length} tone="earth" />
        <Summary label="Sakit" value={herd.filter((animal) => animal.health === "sakit").length} tone="red" />
        <Summary label="Pantau" value={herd.filter((animal) => animal.health === "pantau").length} tone="amber" />
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium",
              filter === item.id ? "bg-forest-800 text-white" : "border border-slate-300 bg-white text-ink",
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
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Tidak ada ternak pada saringan ini.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((animal) => {
            const log = latestHealthLog(book.healthLogs, animal.earTag);
            const pen = book.pens.find((item) => item.id === animal.penId);
            return (
              <li key={animal.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-xl text-ink">
                        <Link href={`/livestock/health/${animal.id}`} className="inline-flex min-h-11 items-center">
                          {animal.earTag}
                        </Link>
                      </h2>
                      <p className="text-sm text-slate-600">
                        {SPECIES_LABEL[animal.species]} · {pen?.name ?? "Kandang"}
                        {animal.headcount > 1 ? ` · ${animal.headcount} ekor` : ""}
                      </p>
                      <Link href={`/livestock/health/${animal.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-800">
                        Protokol pengobatan
                      </Link>
                    </div>
                    <Badge tone={statusTone(animal.health)}>{labelForHerd(animal.health)}</Badge>
                  </div>
                  {log ? (
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <Metric label="Skor" value={String(log.score)} />
                      <Metric label="Suhu" value={formatTemp(log.temperatureC)} />
                      <Metric label="Aktivitas" value={`${log.activityLevel}/100`} />
                    </dl>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Belum ada pemeriksaan.</p>
                  )}
                  {log ? (
                    <div className="mt-3 space-y-2">
                      <Badge tone={riskTone(log.riskLevel)}>Risiko {RISK_LABEL[log.riskLevel]}</Badge>
                      <p className="text-sm leading-6 text-slate-700">{log.diagnosticNote}</p>
                      <p className="text-sm leading-6 text-earth-900">{log.treatment}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(log.checkedAt)}
                        {log.manual ? " · ditetapkan manual" : ""}
                      </p>
                    </div>
                  ) : null}
                  {canUpdate ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {CHECK_STATUSES.map((status) => (
                        <Button
                          key={status}
                          variant={status === "SICK" ? "danger" : "secondary"}
                          disabled={pendingId === animal.id || herdStatusForCheck(status) === animal.health}
                          onClick={() => void commitStatus(animal, status)}
                        >
                          {CHECK_LABEL[status]}
                        </Button>
                      ))}
                      <Button disabled={pendingId === animal.id} onClick={() => setChecking(animal)}>
                        Periksa
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <CheckModal
        key={checking?.id ?? "none"}
        animal={checking}
        onClose={() => setChecking(null)}
        onSaved={() => setChecking(null)}
        onError={setError}
      />
    </div>
  );
}

function CheckModal({
  animal,
  onClose,
  onSaved,
  onError,
}: {
  animal: Animal | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [temperature, setTemperature] = useState("");
  const [activity, setActivity] = useState("70");
  const [symptoms, setSymptoms] = useState<SymptomCode[]>([]);
  const [preview, setPreview] = useState<ReturnType<typeof recordHealthCheck> | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const band = animal ? TEMP_BAND[animal.species] : null;

  function reset(next: Animal | null) {
    setTemperature("");
    setActivity("70");
    setSymptoms([]);
    setPreview(null);
    setFormError(null);
    setPending(false);
    if (!next) onClose();
  }

  function toggleSymptom(code: SymptomCode) {
    setPreview(null);
    setSymptoms((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  function onPreview() {
    if (!animal) return;
    const current = getLivestockClient();
    if (!current) {
      setFormError("Data kandang belum siap.");
      return;
    }
    const result = recordHealthCheck(
      current,
      animal.id,
      { temperatureC: Number(temperature), activityLevel: Number(activity), symptoms },
      "preview",
      "2000-01-01T00:00:00.000Z",
    );
    if (!result.ok) {
      setPreview(null);
      setFormError(result.message);
      return;
    }
    setFormError(null);
    setPreview(result);
  }

  async function onSave() {
    if (!animal || !preview || !preview.ok) return;
    setPending(true);
    const denied = await guard("livestock", "update", { id: animal.id, health: herdStatusForCheck(preview.log.status) });
    if (denied) {
      setPending(false);
      setFormError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      setFormError("Data kandang belum siap.");
      return;
    }
    const result = recordHealthCheck(
      current,
      animal.id,
      { temperatureC: Number(temperature), activityLevel: Number(activity), symptoms },
      uid("hlt"),
      new Date().toISOString(),
    );
    if (!result.ok) {
      setPending(false);
      setFormError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPending(false);
      setFormError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    void publishLog(result.log, animal.species);
    setPending(false);
    onError(null);
    onSaved();
    reset(null);
  }

  return (
    <Modal
      open={Boolean(animal)}
      title={animal ? `Periksa ${animal.earTag}` : "Periksa"}
      onClose={() => reset(null)}
    >
      {animal && band ? (
        <div className="space-y-4">
          <Field label="Suhu tubuh (°C)" hint={`Rentang ${SPECIES_LABEL[animal.species].toLowerCase()} ${formatTemp(band.min)}–${formatTemp(band.max)}`}>
            <TextInput
              inputMode="decimal"
              value={temperature}
              onChange={(event) => {
                setPreview(null);
                setTemperature(event.target.value.replace(/[^\d.,]/g, "").replace(",", "."));
              }}
            />
          </Field>
          <Field label="Aktivitas (0–100)" hint="Angka lebih rendah berarti ternak lebih diam dari biasanya.">
            <TextInput
              inputMode="numeric"
              value={activity}
              onChange={(event) => {
                setPreview(null);
                setActivity(event.target.value.replace(/[^\d]/g, "").slice(0, 3));
              }}
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Gejala yang terlihat</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_CODES.map((code) => {
                const active = symptoms.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSymptom(code)}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-sm font-medium",
                      active ? "bg-earth-800 text-white" : "border border-slate-300 bg-white text-ink",
                    )}
                  >
                    {SYMPTOM_LABEL[code]}
                  </button>
                );
              })}
            </div>
          </div>
          {preview?.ok ? (
            <div className="rounded-2xl bg-forest-50 px-3 py-3 text-sm leading-6 text-forest-950">
              <p className="font-semibold">
                Skor {preview.log.score} · {CHECK_LABEL[preview.log.status]} · risiko {RISK_LABEL[preview.log.riskLevel]}
              </p>
              <p className="mt-1">{preview.log.diagnosticNote}</p>
              <p className="mt-1">{preview.log.treatment}</p>
            </div>
          ) : null}
          {formError ? (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onPreview}>
              Hitung skor
            </Button>
            <Button disabled={!preview?.ok || pending} onClick={() => void onSave()}>
              {pending ? "Menyimpan..." : "Simpan pemeriksaan"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "earth" | "red" | "amber" }) {
  const surface = tone === "earth" ? "bg-earth-100 text-earth-900" : tone === "red" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900";
  return (
    <div className={cn("rounded-2xl px-4 py-4", surface)}>
      <p className="text-sm">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-2 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function matchesFilter(health: HealthStatus, filter: FilterId) {
  if (filter === "perhatian") return health === "sakit" || health === "karantina" || health === "pantau";
  return health === herdStatusForCheck(filter);
}

function labelForHerd(health: HealthStatus) {
  if (health === "sehat") return "Sehat";
  if (health === "pantau") return "Pantau";
  if (health === "karantina") return "Karantina";
  if (health === "sakit") return "Sakit";
  return "Terjual";
}

function statusTone(health: HealthStatus) {
  if (health === "sehat") return "forest" as const;
  if (health === "pantau") return "amber" as const;
  if (health === "sakit") return "red" as const;
  return "earth" as const;
}

function riskTone(risk: HealthRiskLevel) {
  if (risk === "LOW") return "forest" as const;
  if (risk === "MEDIUM") return "amber" as const;
  if (risk === "HIGH") return "earth" as const;
  return "red" as const;
}

function formatTemp(value: number) {
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}°C`;
}

function publishLog(log: HealthLog, species: Animal["species"]) {
  void fetch("/api/livestock/health", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: log.id,
      earTag: log.earTag,
      species,
      checkedAt: log.checkedAt,
      temperatureC: log.temperatureC,
      activityLevel: log.activityLevel,
      symptoms: log.symptoms,
      manual: log.manual,
      status: log.status,
    }),
  }).catch(() => undefined);
}
