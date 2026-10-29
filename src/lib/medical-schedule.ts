import { latestHealthLog, manualAssessment, TEMP_BAND, type HealthCheckStatus, type HealthLog } from "@/lib/health";
import type { LivestockBook, LivestockSpecies } from "@/lib/livestock";
import type { MedicalHistoryEntry } from "@/lib/treatment";
import { recommendTreatment } from "@/lib/treatment-protocols";

/** Care planned ahead of time. This is a keeper schedule, not a prescription. */
export type CareKind = "VACCINATION" | "DEWORMING" | "VITAMIN" | "MEDICAL_CARE";

export type CareStatus = "PENDING" | "COMPLETED" | "OVERDUE";

export interface ScheduledTreatment {
  id: string;
  earTag: string;
  kind: CareKind;
  /** Calendar date, YYYY-MM-DD. */
  scheduledOn: string;
  staffName: string;
  dosage: string;
  /** Stored status. OVERDUE on screen is derived when a pending date has passed. */
  status: "PENDING" | "COMPLETED";
  completedAt: string | null;
  note: string;
}

export const CARE_KINDS: CareKind[] = ["VACCINATION", "DEWORMING", "VITAMIN", "MEDICAL_CARE"];

export const CARE_LABEL: Record<CareKind, string> = {
  VACCINATION: "Vaksinasi",
  DEWORMING: "Obat cacing",
  VITAMIN: "Vitamin",
  MEDICAL_CARE: "Perawatan medis",
};

/**
 * Planning text for the keeper. Amounts follow the product label and a veterinarian.
 * The schedule never invents an antibiotic dose in mg/kg.
 */
export const CARE_DOSAGE: Record<CareKind, string> = {
  VACCINATION: "Ikuti label vaksin dan petunjuk dokter hewan. Catat nama produk dan nomor bets.",
  DEWORMING: "Ikuti label obat cacing menurut bobot hidup. Konfirmasi dokter hewan sebelum memberi.",
  VITAMIN: "Ikuti label vitamin. Perkiraan kandang: sapi 5–10 ml, kambing 2–5 ml, unggas dicampur air minum.",
  MEDICAL_CARE: "Ikuti protokol kandang dan label produk. Ini daftar periksa petugas, bukan resep.",
};

export const CARE_STATUS_LABEL: Record<CareStatus, string> = {
  PENDING: "Menunggu",
  COMPLETED: "Selesai",
  OVERDUE: "Terlambat",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCareKind(value: unknown): value is CareKind {
  return CARE_KINDS.some((kind) => kind === value);
}

/** Pending visits whose calendar date is before today are shown as overdue. */
export function effectiveCareStatus(item: ScheduledTreatment, today: string | null): CareStatus {
  if (item.status === "COMPLETED") return "COMPLETED";
  if (today && item.scheduledOn < today) return "OVERDUE";
  return "PENDING";
}

export function scheduleTreatment(
  book: LivestockBook,
  input: { earTag: string; kind: CareKind; scheduledOn: string; staffName: string; dosage: string; note: string },
  id: string,
): { ok: true; book: LivestockBook; treatment: ScheduledTreatment } | { ok: false; message: string } {
  const earTag = input.earTag.trim().toUpperCase();
  const animal = book.animals.find((item) => item.earTag === earTag);
  if (!animal || animal.health === "terjual") return { ok: false, message: "Pilih ternak yang masih di kandang." };
  if (!DATE_PATTERN.test(input.scheduledOn)) return { ok: false, message: "Tanggal jadwal harus YYYY-MM-DD." };
  const staffName = input.staffName.trim();
  if (staffName.length < 2 || staffName.length > 80) return { ok: false, message: "Nama petugas 2–80 karakter." };
  const dosage = input.dosage.trim();
  if (dosage.length < 8 || dosage.length > 240) return { ok: false, message: "Isi dosis perencanaan, 8–240 karakter." };
  const rows = book.scheduledTreatments ?? [];
  const duplicate = rows.some(
    (item) => item.status === "PENDING" && item.earTag === earTag && item.kind === input.kind && item.scheduledOn === input.scheduledOn,
  );
  if (duplicate) return { ok: false, message: "Jadwal yang sama untuk ternak ini sudah menunggu." };
  const treatment: ScheduledTreatment = {
    id,
    earTag,
    kind: input.kind,
    scheduledOn: input.scheduledOn,
    staffName,
    dosage,
    status: "PENDING",
    completedAt: null,
    note: input.note.trim().slice(0, 280),
  };
  return { ok: true, treatment, book: { ...book, scheduledTreatments: [treatment, ...rows] } };
}

/**
 * Marks a visit done, appends medical history, and writes a health log.
 * The clinical status stays as it was: finishing a vaccine does not declare the animal cured.
 */
export function completeScheduledTreatment(
  book: LivestockBook,
  treatmentId: string,
  ids: { logId: string; historyId: string },
  nowIso: string,
):
  | { ok: true; book: LivestockBook; treatment: ScheduledTreatment; log: HealthLog; entry: MedicalHistoryEntry }
  | { ok: false; message: string } {
  const current = (book.scheduledTreatments ?? []).find((item) => item.id === treatmentId);
  if (!current) return { ok: false, message: "Jadwal tidak ditemukan." };
  if (current.status === "COMPLETED") return { ok: false, message: "Jadwal ini sudah selesai." };
  const animal = book.animals.find((item) => item.earTag === current.earTag);
  if (!animal || animal.health === "terjual") return { ok: false, message: "Ternak tidak ditemukan." };

  const treatment: ScheduledTreatment = { ...current, status: "COMPLETED", completedAt: nowIso };
  const previous = latestHealthLog(book.healthLogs ?? [], animal.earTag);
  const status = previous?.status ?? checkStatusForHerd(animal.health);
  const log = careLog(animal.species, animal.earTag, current, status, previous, ids.logId, nowIso);
  const entry = historyEntry(animal, current, log.id, ids.historyId, nowIso, status, previous?.symptoms ?? []);
  return {
    ok: true,
    treatment,
    log,
    entry,
    book: {
      ...book,
      animals: book.animals.map((item) => (item.id === animal.id ? { ...item, health: herdFromCheck(status), updatedAt: nowIso } : item)),
      healthLogs: [log, ...(book.healthLogs ?? []).filter((item) => item.id !== log.id)],
      medicalHistory: [entry, ...(book.medicalHistory ?? [])],
      scheduledTreatments: (book.scheduledTreatments ?? []).map((item) => (item.id === treatment.id ? treatment : item)),
    },
  };
}

export function parseScheduledTreatments(input: unknown): ScheduledTreatment[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<ScheduledTreatment>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.scheduledOn !== "string") return [];
    if (!isCareKind(row.kind) || !DATE_PATTERN.test(row.scheduledOn)) return [];
    if (row.status !== "PENDING" && row.status !== "COMPLETED") return [];
    if (typeof row.staffName !== "string" || typeof row.dosage !== "string") return [];
    return [
      {
        id: row.id,
        earTag: row.earTag,
        kind: row.kind,
        scheduledOn: row.scheduledOn,
        staffName: row.staffName,
        dosage: row.dosage,
        status: row.status,
        completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
        note: typeof row.note === "string" ? row.note : "",
      },
    ];
  });
}

/** Sample visits for a fresh herd book. Saved browsers keep their own schedule. */
export function seedScheduledTreatments(): ScheduledTreatment[] {
  return [
    row("jdw-aym-vaksin", "AYM-L01", "VACCINATION", "2026-10-27", "Agus", "Lot petelur, vaksin ulang."),
    row("jdw-spi-vitamin", "SPI-102", "VITAMIN", "2026-10-29", "Agus", ""),
    row("jdw-kmb-rawat", "KMB-033", "MEDICAL_CARE", "2026-10-30", "Agus", "Lanjutan pincang."),
    row("jdw-kmb-cacing", "KMB-014", "DEWORMING", "2026-11-02", "Rina", ""),
    row("jdw-bdk-vaksin", "BDK-07", "VACCINATION", "2026-11-05", "Agus", "Lot pedaging."),
  ];
}

export function formatScheduleDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return isoDate;
  return `${Number(day)} ${names[index]} ${year}`;
}

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function row(id: string, earTag: string, kind: CareKind, scheduledOn: string, staffName: string, note: string): ScheduledTreatment {
  return {
    id,
    earTag,
    kind,
    scheduledOn,
    staffName,
    dosage: CARE_DOSAGE[kind],
    status: "PENDING",
    completedAt: null,
    note,
  };
}

function careLog(
  species: LivestockSpecies,
  earTag: string,
  item: ScheduledTreatment,
  status: HealthCheckStatus,
  previous: HealthLog | null,
  id: string,
  checkedAt: string,
): HealthLog {
  const band = TEMP_BAND[species];
  const midpoint = Math.round(((band.min + band.max) / 2) * 10) / 10;
  const assessment = manualAssessment(status);
  return {
    id,
    earTag,
    checkedAt,
    temperatureC: previous?.temperatureC ?? midpoint,
    activityLevel: previous?.activityLevel ?? 70,
    symptoms: previous?.symptoms ?? [],
    manual: true,
    status,
    riskLevel: assessment.riskLevel,
    score: assessment.score,
    diagnosticNote: `${CARE_LABEL[item.kind]} ${formatScheduleDate(item.scheduledOn)} dicatat selesai oleh ${item.staffName}. Status klinis tidak diubah.`,
    treatment: item.dosage,
  };
}

function historyEntry(
  animal: LivestockBook["animals"][number],
  item: ScheduledTreatment,
  healthLogId: string,
  id: string,
  appliedAt: string,
  status: HealthCheckStatus,
  symptoms: HealthLog["symptoms"],
): MedicalHistoryEntry {
  const plan = recommendTreatment({ species: animal.species, status, symptoms });
  const medical = item.kind === "MEDICAL_CARE";
  return {
    id,
    earTag: item.earTag,
    healthLogId,
    protocolId: medical ? plan.protocol.id : "rutin",
    protocolName: CARE_LABEL[item.kind],
    summary: `${CARE_LABEL[item.kind]} untuk ${item.earTag} pada ${formatScheduleDate(item.scheduledOn)}. Petugas ${item.staffName}. ${item.dosage}`,
    isolation: medical ? plan.protocol.isolation : "Tetap di kandang. Amati nafsu makan setelah pemberian.",
    appliedAt,
  };
}

function checkStatusForHerd(health: LivestockBook["animals"][number]["health"]): HealthCheckStatus {
  if (health === "pantau") return "OBSERVATION";
  if (health === "karantina") return "QUARANTINE";
  if (health === "sakit") return "SICK";
  return "HEALTHY";
}

function herdFromCheck(status: HealthCheckStatus) {
  if (status === "OBSERVATION") return "pantau" as const;
  if (status === "QUARANTINE") return "karantina" as const;
  if (status === "SICK") return "sakit" as const;
  return "sehat" as const;
}
