"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCan } from "@/components/access/role-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { guard } from "@/lib/guard";
import { CHECK_LABEL, RISK_LABEL, setHerdHealth, type HealthLog } from "@/lib/health";
import { SPECIES_LABEL } from "@/lib/livestock";
import { getLivestockClient, getLivestockServer, replaceLivestock, subscribeLivestock } from "@/lib/livestock-store";
import { assistTreatment } from "@/lib/treatment-assistant";
import { applyProtocol, closeTreatmentCase, openCaseFor, recommendationFor, recordMedicine, type MedicalHistoryEntry, type TreatmentCase } from "@/lib/treatment";
import { SEVERITY_LABEL } from "@/lib/treatment-protocols";
import { labelDoseNote } from "@/lib/veterinary-rules";
import { activeHolds } from "@/lib/withdrawal";
import { cn, uid } from "@/lib/utils";

export function TreatmentDetail({ animalId }: { animalId: string }) {
  const book = useSyncExternalStore(subscribeLivestock, getLivestockClient, getLivestockServer);
  const canUpdate = useCan("livestock", "update");
  const [medicineId, setMedicineId] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawalDays, setWithdrawalDays] = useState("0");
  const [note, setNote] = useState("");
  const [nowIso, setNowIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setNowIso(new Date().toISOString());
  }, []);

  if (!book) return <p className="text-sm text-slate-500">Menyiapkan protokol pengobatan...</p>;
  const found = recommendationFor(book, animalId);
  if (!found) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-600">Ternak tidak ditemukan, atau sudah terjual.</p>
      </div>
    );
  }

  const { animal, log, plan, status, symptoms } = found;
  const pen = book.pens.find((item) => item.id === animal.penId);
  const openCase = openCaseFor(book.treatmentCases, animal.earTag);
  const history = (book.treatmentCases ?? []).filter((item) => item.earTag === animal.earTag && item.status === "selesai").slice(0, 3);
  const selectedMedicine = medicineId || plan.medicines[0]?.id || "lain";
  const advice = assistTreatment({
    species: animal.species,
    status,
    symptoms,
    temperatureC: log?.temperatureC ?? null,
    activityLevel: log?.activityLevel ?? null,
  });
  const appliedHistory = (book.medicalHistory ?? []).filter((item) => item.earTag === animal.earTag);
  const alreadyApplied = appliedHistory.some(
    (item) => item.protocolId === advice.plan.protocol.id && item.healthLogId === (log?.id ?? ""),
  );

  async function onRecord() {
    setPending(true);
    setError(null);
    const denied = await guard("livestock", "update", { id: animalId, health: animal.health });
    if (denied) {
      setPending(false);
      setError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      setError("Data kandang belum siap.");
      return;
    }
    const nowIso = new Date().toISOString();
    const existing = openCaseFor(current.treatmentCases, animal.earTag);
    const result = recordMedicine(
      current,
      animalId,
      { medicineId: selectedMedicine, amount, note, withdrawalDays: Number(withdrawalDays || "0") },
      { caseId: existing?.id ?? uid("kasus"), doseId: uid("dosis") },
      nowIso,
    );
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPending(false);
      setError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    publishCase(result.treatmentCase, animal.species, status, symptoms);
    setAmount("");
    setNote("");
    setPending(false);
  }

  async function onApply() {
    setPending(true);
    setError(null);
    const denied = await guard("livestock", "update", { id: animalId, health: animal.health });
    if (denied) {
      setPending(false);
      setError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      setError("Data kandang belum siap.");
      return;
    }
    const result = applyProtocol(current, animalId, uid("riwayat"), new Date().toISOString());
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    if (!replaceLivestock(result.book)) {
      setPending(false);
      setError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    publishAdvice(result.entry, animal.species, status, symptoms, log);
    setPending(false);
  }

  async function onClose(markHealthy: boolean) {
    if (!openCase) return;
    setPending(true);
    setError(null);
    const denied = await guard("livestock", "update", { id: animalId, health: markHealthy ? "sehat" : animal.health });
    if (denied) {
      setPending(false);
      setError(denied);
      return;
    }
    const current = getLivestockClient();
    if (!current) {
      setPending(false);
      setError("Data kandang belum siap.");
      return;
    }
    const nowIso = new Date().toISOString();
    const closed = closeTreatmentCase(current, openCase.id, nowIso);
    if (!closed.ok) {
      setPending(false);
      setError(closed.message);
      return;
    }
    const healed = markHealthy ? setHerdHealth(closed.book, animalId, "HEALTHY", uid("hlt"), nowIso) : closed;
    if (!healed.ok) {
      setPending(false);
      setError(healed.message);
      return;
    }
    if (!replaceLivestock(healed.book)) {
      setPending(false);
      setError("Perubahan tidak tersimpan. Penyimpanan browser penuh atau diblokir.");
      return;
    }
    publishCase(closed.treatmentCase, animal.species, status, symptoms);
    if (markHealthy && "log" in healed) publishHealth(healed.log, animal.species);
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">{animal.earTag}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {SPECIES_LABEL[animal.species]} · {pen?.name ?? "Kandang"}
            {animal.headcount > 1 ? ` · ${animal.headcount} ekor` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={plan.severity === "berat" ? "red" : plan.severity === "sedang" ? "earth" : "forest"}>
            {SEVERITY_LABEL[plan.severity]}
          </Badge>
          {openCase ? <Badge tone="amber">Kasus terbuka</Badge> : null}
        </div>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        Protokol ini daftar periksa petugas kandang. Dosis wajib mengikuti label produk dan dokter hewan. Ini bukan resep.
      </p>
      <Card className="border-forest-800/20 bg-forest-50">
        <CardTitle>Asisten pengobatan</CardTitle>
        <div className="space-y-3 text-sm leading-6 text-slate-700">
          <p>{advice.narrative}</p>
          <p className="rounded-2xl bg-earth-100 px-3 py-3 text-earth-900">{advice.isolation}</p>
          {advice.medicines.length > 0 ? (
            <ul className="space-y-2">
              {advice.medicines.map((medicine) => (
                <li key={medicine.id}>
                  <span className="font-semibold text-ink">{medicine.name}</span>
                  <span className="text-slate-600"> · {medicine.route}. {medicine.dosage}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {advice.vitamins.length > 0 ? (
            <ul className="space-y-2">
              {advice.vitamins.map((medicine) => (
                <li key={medicine.id}>
                  <span className="font-semibold text-ink">{medicine.name}</span>
                  <span className="text-slate-600"> · {medicine.route}. {medicine.dosage}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {canUpdate && advice.plan.protocol.id !== "rutin" ? (
            <Button disabled={pending || alreadyApplied} onClick={() => void onApply()}>
              {alreadyApplied ? "Sudah dicatat" : pending ? "Menyimpan..." : "Terapkan protokol"}
            </Button>
          ) : null}
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Pemeriksaan</CardTitle>
          {log ? (
            <div className="space-y-3 text-sm leading-6">
              <p className="font-semibold text-ink">
                Skor {log.score} · {CHECK_LABEL[log.status]}
                {log.riskLevel ? ` · risiko ${RISK_LABEL[log.riskLevel]}` : ""}
              </p>
              <p className="text-slate-700">{log.diagnosticNote}</p>
              <p className="text-xs text-slate-500">{formatDateTime(log.checkedAt)}{log.manual ? " · ditetapkan manual" : ""}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Belum ada pemeriksaan sensor. Rekomendasi mengikuti status kandang saat ini.</p>
          )}
        </Card>
        <Card>
          <CardTitle>{plan.protocol.name}</CardTitle>
          <div className="space-y-3 text-sm leading-6">
            <p className="text-slate-700">{plan.protocol.summary}</p>
            {plan.reasons.map((reason) => (
              <p key={reason} className="text-slate-600">{reason}</p>
            ))}
            <p className="rounded-2xl bg-earth-100 px-3 py-3 text-earth-900">{plan.protocol.isolation}</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Langkah pemulihan</CardTitle>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
          {plan.protocol.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {plan.medicines.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {plan.medicines.map((medicine) => (
              <li key={medicine.id} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm leading-6">
                <p className="font-semibold text-ink">{medicine.name}</p>
                <p className="text-slate-600">{medicine.route}</p>
                <p className="text-slate-700">{medicine.dosage}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Tidak ada obat yang disarankan untuk pemantauan rutin.</p>
        )}
      </Card>
      {canUpdate && (plan.medicines.length > 0 || openCase) ? (
        <Card>
          <CardTitle>Pemberian obat</CardTitle>
          {openCase ? <DoseList doses={openCase.doses} /> : <p className="mb-4 text-sm text-slate-600">Belum ada obat yang dicatat pada kasus ini.</p>}
          {plan.medicines.length > 0 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Obat</span>
                <select
                  value={selectedMedicine}
                  onChange={(event) => setMedicineId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  {plan.medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>{medicine.name}</option>
                  ))}
                  <option value="lain">Tindakan lain</option>
                </select>
              </label>
              <p className="text-sm leading-6 text-slate-600">{labelDoseNote(found.animal.species, found.animal.weightKg)}</p>
              {nowIso && activeHolds(book.treatmentCases.filter((item) => item.earTag === found.animal.earTag).flatMap((item) => item.doses), nowIso).length > 0 ? (
                <p className="rounded-xl bg-earth-50 px-3 py-3 text-sm leading-6 text-earth-900">
                  Periode henti obat masih berjalan. Susu dan daging belum boleh diedarkan.
                </p>
              ) : null}
              <Field label="Jumlah yang diberikan" hint="Contoh: 1 liter larutan, atau 1 kali oles. Bukan hitungan mg/kg.">
                <TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
              </Field>
              <Field label="Hari henti obat pada label" hint="Isi angka yang tercetak di label. Nol jika label tidak meminta henti obat.">
                <TextInput inputMode="numeric" value={withdrawalDays} onChange={(event) => setWithdrawalDays(event.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
              </Field>
              <Field label="Catatan" hint="Opsional.">
                <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
              <Button disabled={pending} onClick={() => void onRecord()}>
                {pending ? "Menyimpan..." : "Catat pemberian obat"}
              </Button>
            </div>
          ) : null}
          {openCase ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => void onClose(false)}>
                Tutup kasus
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => void onClose(true)}>
                Tutup dan tandai sehat
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {appliedHistory.length > 0 ? (
        <Card>
          <CardTitle>Riwayat medis</CardTitle>
          <ul className="space-y-3">
            {appliedHistory.map((item) => (
              <li key={item.id} className="text-sm leading-6 text-slate-700">
                <p className="font-medium text-ink">{item.protocolName}</p>
                <p>{item.summary}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.appliedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {history.length > 0 ? (
        <Card>
          <CardTitle>Kasus selesai</CardTitle>
          <ul className="space-y-3">
            {history.map((item) => (
              <li key={item.id} className="text-sm leading-6 text-slate-700">
                <span className="font-medium text-ink">{item.doses.length} pemberian</span>
                {item.closedAt ? ` · ditutup ${formatDateTime(item.closedAt)}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function DoseList({ doses }: { doses: TreatmentCase["doses"] }) {
  if (doses.length === 0) return <p className="mb-4 text-sm text-slate-600">Kasus terbuka, belum ada obat yang dicatat.</p>;
  return (
    <ul className="mb-4 space-y-2">
      {doses.map((dose) => (
        <li key={dose.id} className="rounded-xl bg-paper px-3 py-3 text-sm leading-6">
          <p className="font-medium text-ink">{dose.medicineName} · {dose.amount}</p>
          <p className="text-slate-600">{formatDateTime(dose.givenAt)}{dose.note ? ` · ${dose.note}` : ""}</p>
        </li>
      ))}
    </ul>
  );
}

function BackLink() {
  return (
    <Link href="/livestock/health" className={cn("inline-flex min-h-11 items-center text-sm font-semibold text-forest-800")}>
      Kembali ke kesehatan
    </Link>
  );
}

function publishAdvice(
  entry: MedicalHistoryEntry,
  species: "sapi" | "kambing" | "ayam" | "bebek",
  status: HealthLog["status"],
  symptoms: HealthLog["symptoms"],
  log: HealthLog | null,
) {
  void fetch("/api/livestock/treatment/assist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      species,
      status,
      symptoms,
      temperatureC: log?.temperatureC ?? null,
      activityLevel: log?.activityLevel ?? null,
      entry,
    }),
  }).catch(() => undefined);
}

function publishCase(
  treatmentCase: TreatmentCase,
  species: "sapi" | "kambing" | "ayam" | "bebek",
  status: HealthLog["status"],
  symptoms: HealthLog["symptoms"],
) {
  void fetch("/api/livestock/treatment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ species, status, symptoms, treatmentCase }),
  }).catch(() => undefined);
}

function publishHealth(log: HealthLog, species: "sapi" | "kambing" | "ayam" | "bebek") {
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
