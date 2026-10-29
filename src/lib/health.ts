import type { LivestockBook, LivestockSpecies } from "@/lib/livestock";

/** Clinical band used by the simulator. Matches the check-up status stored on a log. */
export type HealthCheckStatus = "HEALTHY" | "OBSERVATION" | "QUARANTINE" | "SICK";

export type HealthRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SymptomCode = "lesu" | "nafsu_makan" | "diare" | "batuk" | "pincang" | "cairan";

export interface HealthLog {
  id: string;
  earTag: string;
  checkedAt: string;
  status: HealthCheckStatus;
  temperatureC: number;
  activityLevel: number;
  symptoms: SymptomCode[];
  riskLevel: HealthRiskLevel;
  score: number;
  diagnosticNote: string;
  treatment: string;
  manual: boolean;
}

export interface HealthAssessment {
  status: HealthCheckStatus;
  riskLevel: HealthRiskLevel;
  score: number;
  diagnosticNote: string;
  treatment: string;
}

export interface HealthReading {
  species: LivestockSpecies;
  temperatureC: number;
  activityLevel: number;
  symptoms: SymptomCode[];
}

export const CHECK_STATUSES: HealthCheckStatus[] = ["HEALTHY", "OBSERVATION", "QUARANTINE", "SICK"];

export const SYMPTOM_CODES: SymptomCode[] = ["lesu", "nafsu_makan", "diare", "batuk", "pincang", "cairan"];

export const CHECK_LABEL: Record<HealthCheckStatus, string> = {
  HEALTHY: "Sehat",
  OBSERVATION: "Pantau",
  QUARANTINE: "Karantina",
  SICK: "Sakit",
};

export const RISK_LABEL: Record<HealthRiskLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

export const SYMPTOM_LABEL: Record<SymptomCode, string> = {
  lesu: "Lesu",
  nafsu_makan: "Nafsu makan turun",
  diare: "Diare",
  batuk: "Batuk",
  pincang: "Pincang",
  cairan: "Keluar cairan",
};

/** Herd status written back onto the animal when a check is saved. */
export function herdStatusForCheck(status: HealthCheckStatus) {
  if (status === "HEALTHY") return "sehat" as const;
  if (status === "OBSERVATION") return "pantau" as const;
  if (status === "QUARANTINE") return "karantina" as const;
  return "sakit" as const;
}

/**
 * Resting temperature band in °C used only by the simulator.
 * Sapi and kambing sit near 38–40°C. Ayam and bebek run hotter, near 40–42°C.
 */
export const TEMP_BAND: Record<LivestockSpecies, { min: number; max: number }> = {
  sapi: { min: 38, max: 39.3 },
  kambing: { min: 38.5, max: 40 },
  ayam: { min: 40.5, max: 42 },
  bebek: { min: 40, max: 42 },
};

const SPECIES_NAME: Record<LivestockSpecies, string> = {
  sapi: "sapi",
  kambing: "kambing",
  ayam: "ayam",
  bebek: "bebek",
};

const TREATMENT: Record<HealthCheckStatus, string> = {
  HEALTHY: "Lanjutkan pakan dan air seperti biasa. Periksa ulang dalam 7 hari.",
  OBSERVATION: "Amati di kandang yang sama. Catat suhu besok pagi dan periksa tempat pakan serta minum.",
  QUARANTINE: "Pindahkan ke kandang karantina dan batasi kontak. Hubungi petugas kesehatan ternak jika suhu tidak turun dalam 24 jam.",
  SICK: "Karantina ketat, jangan campur dengan ternak sehat. Segera periksa dokter hewan dan catat gejala setiap 6 jam.",
};

const MANUAL_SCORE: Record<HealthCheckStatus, number> = {
  HEALTHY: 92,
  OBSERVATION: 74,
  QUARANTINE: 55,
  SICK: 28,
};

const RISK_FOR_STATUS: Record<HealthCheckStatus, HealthRiskLevel> = {
  HEALTHY: "LOW",
  OBSERVATION: "MEDIUM",
  QUARANTINE: "HIGH",
  SICK: "CRITICAL",
};

const STATUS_RANK: Record<HealthCheckStatus, number> = {
  HEALTHY: 0,
  OBSERVATION: 1,
  QUARANTINE: 2,
  SICK: 3,
};

export function isCheckStatus(value: unknown): value is HealthCheckStatus {
  return value === "HEALTHY" || value === "OBSERVATION" || value === "QUARANTINE" || value === "SICK";
}

export function isSymptom(value: unknown): value is SymptomCode {
  return SYMPTOM_CODES.some((code) => code === value);
}

export function isSpecies(value: unknown): value is LivestockSpecies {
  return value === "sapi" || value === "kambing" || value === "ayam" || value === "bebek";
}

/**
 * Simulated health score from 0 to 100.
 * This is a planning aid for the keeper. It is not a veterinary diagnosis.
 *
 * Start at 100, then deduct:
 * - 20 points per °C outside the species temperature band, capped at 45
 * - activity from an ear-tag stand-in: 0 at 70 or above, 12 at 50–69, 24 at 30–49, otherwise 36
 * - 10 points per listed visual symptom, capped at 30
 *
 * Score 85+ is sehat/rendah, 70+ pantau/sedang, 50+ karantina/tinggi, and below that sakit/kritis.
 * A gap of 1.5°C or more raises the floor to karantina.
 * Activity under 30 together with two symptoms raises the result to sakit.
 */
export function assessHealth(reading: HealthReading): HealthAssessment {
  const band = TEMP_BAND[reading.species];
  const temperatureC = Math.round(reading.temperatureC * 10) / 10;
  const activityLevel = Math.round(reading.activityLevel);
  const delta = temperatureGap(temperatureC, band);
  const tempPenalty = Math.min(45, Math.round(delta * 20));
  const activityPenalty = activityLevel >= 70 ? 0 : activityLevel >= 50 ? 12 : activityLevel >= 30 ? 24 : 36;
  const symptomPenalty = Math.min(30, reading.symptoms.length * 10);
  const score = Math.max(0, 100 - tempPenalty - activityPenalty - symptomPenalty);

  let status = statusFromScore(score);
  if (delta >= 1.5 && STATUS_RANK[status] < STATUS_RANK.QUARANTINE) status = "QUARANTINE";
  if (activityLevel < 30 && reading.symptoms.length >= 2) status = "SICK";

  const riskLevel = RISK_FOR_STATUS[status];
  const symptomText = reading.symptoms.length
    ? reading.symptoms.map((code) => SYMPTOM_LABEL[code]).join(", ")
    : "tidak ada gejala visual";
  const rangeText = delta === 0 ? "di dalam rentang normal" : `${formatGap(delta)} di luar rentang`;
  const diagnosticNote = `Suhu ${formatTemp(temperatureC)}, ${rangeText} ${formatTemp(band.min)}–${formatTemp(band.max)} untuk ${SPECIES_NAME[reading.species]}. Aktivitas ${activityLevel} dari 100. Gejala: ${symptomText}. Skor simulasi ${score}, risiko ${RISK_LABEL[riskLevel]}.`;

  return {
    status,
    riskLevel,
    score,
    diagnosticNote,
    treatment: TREATMENT[status],
  };
}

export function manualAssessment(status: HealthCheckStatus): HealthAssessment {
  return {
    status,
    riskLevel: RISK_FOR_STATUS[status],
    score: MANUAL_SCORE[status],
    diagnosticNote: "Status ditetapkan manual oleh petugas kandang, tanpa pemeriksaan sensor baru.",
    treatment: TREATMENT[status],
  };
}

export function latestHealthLog(logs: HealthLog[], earTag: string) {
  return logs
    .filter((log) => log.earTag === earTag)
    .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0] ?? null;
}

export function recordHealthCheck(
  book: LivestockBook,
  animalId: string,
  reading: Omit<HealthReading, "species">,
  id: string,
  checkedAt: string,
): { ok: true; book: LivestockBook; log: HealthLog } | { ok: false; message: string } {
  const animal = book.animals.find((item) => item.id === animalId);
  if (!animal) return { ok: false, message: "Ternak tidak ditemukan." };
  if (animal.health === "terjual") return { ok: false, message: "Ternak yang sudah terjual tidak diperiksa." };
  const temperatureC = Math.round(reading.temperatureC * 10) / 10;
  const activityLevel = Math.round(reading.activityLevel);
  if (!Number.isFinite(temperatureC) || temperatureC < 34 || temperatureC > 45) {
    return { ok: false, message: "Suhu harus antara 34 dan 45°C." };
  }
  if (!Number.isInteger(activityLevel) || activityLevel < 0 || activityLevel > 100) {
    return { ok: false, message: "Aktivitas harus bilangan 0–100." };
  }
  const assessment = assessHealth({
    species: animal.species,
    temperatureC,
    activityLevel,
    symptoms: reading.symptoms,
  });
  const log: HealthLog = {
    id,
    earTag: animal.earTag,
    checkedAt,
    temperatureC,
    activityLevel,
    symptoms: reading.symptoms,
    manual: false,
    ...assessment,
  };
  return { ok: true, log, book: writeLog(book, animal.id, log) };
}

export function setHerdHealth(
  book: LivestockBook,
  animalId: string,
  status: HealthCheckStatus,
  id: string,
  checkedAt: string,
): { ok: true; book: LivestockBook; log: HealthLog } | { ok: false; message: string } {
  const animal = book.animals.find((item) => item.id === animalId);
  if (!animal) return { ok: false, message: "Ternak tidak ditemukan." };
  if (animal.health === "terjual") return { ok: false, message: "Ternak yang sudah terjual tidak diubah." };
  const previous = latestHealthLog(book.healthLogs, animal.earTag);
  const fallback = defaultSensors(animal.species);
  const log: HealthLog = {
    id,
    earTag: animal.earTag,
    checkedAt,
    temperatureC: previous?.temperatureC ?? fallback.temperatureC,
    activityLevel: previous?.activityLevel ?? fallback.activityLevel,
    symptoms: previous?.symptoms ?? [],
    manual: true,
    ...manualAssessment(status),
  };
  return { ok: true, log, book: writeLog(book, animal.id, log) };
}

export function parseHealthLogs(input: unknown): HealthLog[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<HealthLog>;
    if (typeof row.id !== "string" || typeof row.earTag !== "string" || typeof row.checkedAt !== "string") return [];
    if (!isCheckStatus(row.status) || !isRisk(row.riskLevel)) return [];
    if (typeof row.temperatureC !== "number" || typeof row.activityLevel !== "number" || typeof row.score !== "number") return [];
    if (typeof row.diagnosticNote !== "string" || typeof row.treatment !== "string") return [];
    const symptoms = Array.isArray(row.symptoms) ? row.symptoms.filter(isSymptom) : [];
    return [
      {
        id: row.id,
        earTag: row.earTag,
        checkedAt: row.checkedAt,
        status: row.status,
        temperatureC: row.temperatureC,
        activityLevel: row.activityLevel,
        symptoms,
        riskLevel: row.riskLevel,
        score: row.score,
        diagnosticNote: row.diagnosticNote,
        treatment: row.treatment,
        manual: row.manual === true,
      },
    ];
  });
}

/** Sample checks for a fresh herd book. Existing browsers keep their own saved logs. */
export function seedHealthLogs(): HealthLog[] {
  const samples: Array<HealthReading & { id: string; earTag: string; checkedAt: string }> = [
    {
      id: "hlt-spi-118",
      earTag: "SPI-118",
      species: "sapi",
      temperatureC: 39.6,
      activityLevel: 58,
      symptoms: ["nafsu_makan"],
      checkedAt: "2026-10-28T01:00:00.000Z",
    },
    {
      id: "hlt-kmb-033",
      earTag: "KMB-033",
      species: "kambing",
      temperatureC: 41.2,
      activityLevel: 25,
      symptoms: ["pincang", "lesu"],
      checkedAt: "2026-10-28T02:00:00.000Z",
    },
    {
      id: "hlt-bdk-12",
      earTag: "BDK-12",
      species: "bebek",
      temperatureC: 42.6,
      activityLevel: 48,
      symptoms: ["lesu"],
      checkedAt: "2026-10-27T23:30:00.000Z",
    },
  ];
  return samples.map((sample) => {
    const assessment = assessHealth(sample);
    return {
      id: sample.id,
      earTag: sample.earTag,
      checkedAt: sample.checkedAt,
      temperatureC: sample.temperatureC,
      activityLevel: sample.activityLevel,
      symptoms: sample.symptoms,
      manual: false,
      ...assessment,
    };
  });
}

function writeLog(book: LivestockBook, animalId: string, log: HealthLog): LivestockBook {
  const health = herdStatusForCheck(log.status);
  return {
    ...book,
    animals: book.animals.map((item) => (item.id === animalId ? { ...item, health, updatedAt: log.checkedAt } : item)),
    healthLogs: [log, ...book.healthLogs.filter((item) => item.id !== log.id)],
  };
}

function defaultSensors(species: LivestockSpecies) {
  const band = TEMP_BAND[species];
  return {
    temperatureC: Math.round(((band.min + band.max) / 2) * 10) / 10,
    activityLevel: 70,
  };
}

function temperatureGap(temperatureC: number, band: { min: number; max: number }) {
  if (temperatureC < band.min) return Math.round((band.min - temperatureC) * 10) / 10;
  if (temperatureC > band.max) return Math.round((temperatureC - band.max) * 10) / 10;
  return 0;
}

function statusFromScore(score: number): HealthCheckStatus {
  if (score >= 85) return "HEALTHY";
  if (score >= 70) return "OBSERVATION";
  if (score >= 50) return "QUARANTINE";
  return "SICK";
}

function isRisk(value: unknown): value is HealthRiskLevel {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL";
}

function formatTemp(value: number) {
  return `${value.toFixed(1)}°C`;
}

function formatGap(value: number) {
  return `${value.toFixed(1)}°C`;
}
