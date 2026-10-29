import type { HealthCheckStatus, SymptomCode } from "@/lib/health";
import { CHECK_LABEL, SYMPTOM_LABEL } from "@/lib/health";
import type { LivestockSpecies } from "@/lib/livestock";

export type ProtocolSeverity = "ringan" | "sedang" | "berat";

export interface ProtocolMedicine {
  id: string;
  name: string;
  route: string;
  /** Planning range per species. The keeper still confirms the product label and a veterinarian. */
  dosage: Record<LivestockSpecies, string>;
}

export interface TreatmentProtocol {
  id: string;
  name: string;
  severity: ProtocolSeverity;
  /** Empty only for the routine watch protocol. */
  symptoms: SymptomCode[];
  routine: boolean;
  summary: string;
  isolation: string;
  medicines: ProtocolMedicine[];
  steps: string[];
}

export interface TreatmentRecommendation {
  protocol: TreatmentProtocol;
  severity: ProtocolSeverity;
  matchedSymptoms: SymptomCode[];
  reasons: string[];
  medicines: Array<{ id: string; name: string; route: string; dosage: string }>;
}

export const SEVERITY_LABEL: Record<ProtocolSeverity, string> = {
  ringan: "Ringan",
  sedang: "Sedang",
  berat: "Berat",
};

const FLUID: Record<LivestockSpecies, string> = {
  sapi: "Perkiraan perencanaan 1–2 liter larutan, dibagi pagi dan sore.",
  kambing: "Perkiraan perencanaan 200–400 ml larutan, dibagi pagi dan sore.",
  ayam: "Perkiraan perencanaan 50–100 ml per ekor, dibagi pagi dan sore.",
  bebek: "Perkiraan perencanaan 50–100 ml per ekor, dibagi pagi dan sore.",
};

const ANTISEPTIC: Record<LivestockSpecies, string> = {
  sapi: "Oleskan pada kulit utuh atau luka luar sesuai label, 1–2 kali sehari. Jangan dipakai pada luka dalam.",
  kambing: "Oleskan pada kulit utuh atau luka luar sesuai label, 1–2 kali sehari. Jangan dipakai pada luka dalam.",
  ayam: "Oles tipis pada luka luar sesuai label. Jangan mengenai mata.",
  bebek: "Oles tipis pada luka luar sesuai label. Jangan mengenai mata.",
};

/**
 * Standard herd protocols. These are keeper checklists, not a veterinary prescription.
 * Any medicine dose must follow the product label and a veterinarian.
 */
export const TREATMENT_PROTOCOLS: TreatmentProtocol[] = [
  {
    id: "rutin",
    name: "Pemantauan rutin",
    severity: "ringan",
    symptoms: [],
    routine: true,
    summary: "Tidak ada gejala yang meminta pengobatan. Lanjutkan perawatan harian.",
    isolation: "Tidak perlu dipisahkan dari kandang.",
    medicines: [],
    steps: [
      "Sediakan air bersih dan pakan seperti biasa.",
      "Amati nafsu makan, kotoran, dan cara berjalan setiap hari.",
      "Catat pemeriksaan berikutnya dalam 7 hari.",
    ],
  },
  {
    id: "nafsu-makan",
    name: "Nafsu makan turun",
    severity: "sedang",
    symptoms: ["nafsu_makan"],
    routine: false,
    summary: "Ternak mengurangi atau menolak pakan. Periksa air, pakan, dan demam sebelum memberi obat.",
    isolation: "Amati di kandang yang sama. Pisahkan jika tidak makan selama 24 jam.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
    ],
    steps: [
      "Ganti air minum dan buang pakan yang basi.",
      "Berikan larutan elektrolit sesuai label, lalu catat jumlah yang diminum.",
      "Ukur suhu besok pagi. Hubungi dokter hewan jika tetap tidak makan.",
    ],
  },
  {
    id: "diare",
    name: "Gangguan pencernaan",
    severity: "sedang",
    symptoms: ["diare"],
    routine: false,
    summary: "Kotoran encer. Jaga cairan tubuh dan bersihkan lantai agar tidak menular.",
    isolation: "Pisahkan dari ternak lain, bersihkan lantai, dan jangan mencampur pakan sisa.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
    ],
    steps: [
      "Berikan air bersih terus-menerus dan larutan elektrolit sesuai label.",
      "Jangan memberi obat antidiare tanpa resep dokter hewan.",
      "Catat warna dan kekentalan kotoran setiap pemberian pakan.",
      "Hubungi dokter hewan jika diare berdarah, ternak lemas, atau tidak membaik dalam 24 jam.",
    ],
  },
  {
    id: "pernapasan",
    name: "Gangguan pernapasan",
    severity: "berat",
    symptoms: ["batuk", "cairan"],
    routine: false,
    summary: "Batuk atau cairan dari hidung bisa menular. Kurangi kepadatan dan perbaiki aliran udara.",
    isolation: "Pindahkan ke kandang karantina dengan ventilasi baik. Jangan dicampur dengan ternak sehat.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
    ],
    steps: [
      "Pisahkan ternak dan keringkan lantai kandang.",
      "Catat frekuensi batuk dan suhu setiap 6 jam.",
      "Antibiotik atau obat pernapasan hanya diberikan dengan resep dokter hewan.",
      "Jaga kandang tidak pengap, berdebu, atau terlalu dingin pada malam hari.",
    ],
  },
  {
    id: "pincang",
    name: "Pincang dan luka kaki",
    severity: "sedang",
    symptoms: ["pincang"],
    routine: false,
    summary: "Ternak menghindari tumpuan kaki. Istirahatkan di lantai kering sebelum menilai perlu tidaknya obat.",
    isolation: "Sediakan lantai kering dan tidak licin. Pisahkan jika terinjak ternak lain.",
    medicines: [
      {
        id: "antiseptik",
        name: "Antiseptik luka luar",
        route: "Oles",
        dosage: ANTISEPTIC,
      },
    ],
    steps: [
      "Periksa kuku, bengkak, dan luka tanpa memaksa ternak berjalan jauh.",
      "Bersihkan luka luar dan oleskan antiseptik sesuai label.",
      "Pereda nyeri atau suntikan hanya dengan resep dokter hewan.",
      "Nilai lagi besok. Jika bengkak bertambah atau ternak tidak berdiri, hubungi dokter hewan.",
    ],
  },
  {
    id: "lesu-demam",
    name: "Lesu dan demam",
    severity: "sedang",
    symptoms: ["lesu"],
    routine: false,
    summary: "Ternak kurang aktif. Utamakan air, tempat teduh, dan pencatatan suhu.",
    isolation: "Amati terpisah di sudut kandang. Karantina jika demam tidak turun dalam 24 jam.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
    ],
    steps: [
      "Pindahkan ke tempat teduh dengan alas kering.",
      "Berikan air bersih dan larutan elektrolit sesuai label.",
      "Catat suhu pagi dan sore.",
      "Jangan memberi obat penurun panas atau antibiotik tanpa dokter hewan.",
    ],
  },
  {
    id: "lesu-pincang",
    name: "Lesu disertai pincang",
    severity: "berat",
    symptoms: ["lesu", "pincang"],
    routine: false,
    summary: "Gabungan lesu dan gangguan kaki. Pisahkan ternak dan libatkan dokter hewan jika tidak membaik.",
    isolation: "Karantina di lantai kering. Jangan dicampur sampai ternak mau makan dan menumpu kaki.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
      {
        id: "antiseptik",
        name: "Antiseptik luka luar",
        route: "Oles",
        dosage: ANTISEPTIC,
      },
    ],
    steps: [
      "Pisahkan ternak dan periksa luka atau bengkak pada kaki.",
      "Bersihkan luka luar, lalu oleskan antiseptik sesuai label.",
      "Tawarkan air dan elektrolit. Catat apakah ternak minum.",
      "Hubungi dokter hewan jika ternak tidak berdiri, demam, atau tidak makan pada hari yang sama.",
    ],
  },
  {
    id: "pantau-ketat",
    name: "Pengawasan ketat",
    severity: "berat",
    symptoms: [],
    routine: false,
    summary: "Status kandang meminta perhatian, tetapi belum ada gejala visual yang mengarah ke satu protokol.",
    isolation: "Pisahkan dari ternak sehat sampai pemeriksaan berikutnya selesai.",
    medicines: [
      {
        id: "elektrolit",
        name: "Elektrolit oral",
        route: "Oral",
        dosage: FLUID,
      },
    ],
    steps: [
      "Catat suhu, nafsu makan, kotoran, dan cara berjalan setiap 6 jam.",
      "Sediakan air bersih dan alas kering.",
      "Jangan memulai antibiotik tanpa pemeriksaan dokter hewan.",
      "Perbarui gejala pada pemeriksaan berikutnya agar protokol bisa lebih spesifik.",
    ],
  },
];

const SEVERITY_RANK: Record<ProtocolSeverity, number> = { ringan: 0, sedang: 1, berat: 2 };

const STATUS_SEVERITY: Record<HealthCheckStatus, ProtocolSeverity> = {
  HEALTHY: "ringan",
  OBSERVATION: "ringan",
  QUARANTINE: "sedang",
  SICK: "berat",
};

/**
 * Picks one protocol from the health log.
 * Each matching symptom adds 20 points. A protocol whose symptoms are all present adds 10.
 * Sicker herd status adds a small bonus so a tie leans toward the stricter checklist.
 * The routine protocol is used only when nothing else matches.
 */
export function recommendTreatment(
  input: {
    species: LivestockSpecies;
    status: HealthCheckStatus;
    symptoms: SymptomCode[];
  },
  protocols: TreatmentProtocol[] = TREATMENT_PROTOCOLS,
): TreatmentRecommendation {
  const symptoms = uniqueSymptoms(input.symptoms);
  let best: { protocol: TreatmentProtocol; score: number; matched: SymptomCode[] } | null = null;

  for (const protocol of protocols) {
    if (protocol.routine || protocol.id === "pantau-ketat") continue;
    const matched = protocol.symptoms.filter((code) => symptoms.includes(code));
    if (matched.length === 0) continue;
    const complete = protocol.symptoms.every((code) => symptoms.includes(code)) ? 10 : 0;
    const score = matched.length * 20 + complete + statusBonus(input.status);
    if (!best || score > best.score) best = { protocol, score, matched };
  }

  if (!best && (input.status === "SICK" || input.status === "QUARANTINE")) {
    const protocol = findProtocol(protocols, "pantau-ketat");
    best = { protocol, score: 1, matched: symptoms };
  }

  if (!best) {
    const protocol = findProtocol(protocols, "rutin");
    best = { protocol, score: 0, matched: [] };
  }

  const severity = worseSeverity(best.protocol.severity, STATUS_SEVERITY[input.status]);
  const reasons = [
    `Status pemeriksaan ${CHECK_LABEL[input.status]}.`,
    best.matched.length
      ? `Gejala yang cocok: ${best.matched.map((code) => SYMPTOM_LABEL[code]).join(", ")}.`
      : "Belum ada gejala visual yang mengarah ke satu penyakit.",
  ];
  const listed = best.protocol.medicines.map((medicine) => ({
    id: medicine.id,
    name: medicine.name,
    route: medicine.route,
    dosage: medicine.dosage[input.species],
  }));
  const medicines = best.protocol.routine || listed.some((medicine) => medicine.id === "vitamin-b")
    ? listed
    : [...listed, vitaminDose(input.species)];

  return {
    protocol: best.protocol,
    severity,
    matchedSymptoms: best.matched,
    reasons,
    medicines,
  };
}

export function protocolById(id: string) {
  return findProtocol(TREATMENT_PROTOCOLS, id);
}

const VITAMIN: Record<LivestockSpecies, string> = {
  sapi: "Perkiraan 5–10 ml larutan oral sesuai label, sekali sehari. Konfirmasi dokter hewan.",
  kambing: "Perkiraan 2–5 ml larutan oral sesuai label, sekali sehari. Konfirmasi dokter hewan.",
  ayam: "Campur air minum sesuai label per ekor. Konfirmasi dokter hewan.",
  bebek: "Campur air minum sesuai label per ekor. Konfirmasi dokter hewan.",
};

function vitaminDose(species: LivestockSpecies) {
  return {
    id: "vitamin-b",
    name: "Vitamin B kompleks",
    route: "Oral",
    dosage: VITAMIN[species],
  };
}

function findProtocol(protocols: TreatmentProtocol[], id: string) {
  return protocols.find((protocol) => protocol.id === id) ?? protocols.find((protocol) => protocol.routine) ?? protocols[0];
}

export function isProtocolId(value: unknown): value is string {
  return typeof value === "string" && TREATMENT_PROTOCOLS.some((protocol) => protocol.id === value);
}

function uniqueSymptoms(symptoms: SymptomCode[]) {
  return symptoms.filter((code, index) => symptoms.indexOf(code) === index);
}

function statusBonus(status: HealthCheckStatus) {
  if (status === "SICK") return 6;
  if (status === "QUARANTINE") return 4;
  if (status === "OBSERVATION") return 2;
  return 0;
}

function worseSeverity(left: ProtocolSeverity, right: ProtocolSeverity) {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}
