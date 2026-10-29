import type { SymptomCode } from "@/lib/health";
import { SYMPTOM_LABEL } from "@/lib/health";
import type { LivestockSpecies } from "@/lib/livestock";
import { protocolById, TREATMENT_PROTOCOLS } from "@/lib/treatment-protocols";

export interface VeterinaryRule {
  id: string;
  symptom: SymptomCode;
  protocolId: string;
  summary: string;
}

/**
 * Maps one recorded symptom to the keeper protocol already used on the health page.
 * The match is a checklist, not a diagnosis, and it does not compute mg/kg.
 */
export const VETERINARY_RULES: VeterinaryRule[] = TREATMENT_PROTOCOLS.filter((protocol) => !protocol.routine && protocol.symptoms.length > 0).flatMap(
  (protocol) =>
    protocol.symptoms.map((symptom) => ({
      id: `${protocol.id}-${symptom}`,
      symptom,
      protocolId: protocol.id,
      summary: `${SYMPTOM_LABEL[symptom]} mengarah ke daftar periksa ${protocol.name}. Ikuti label produk dan dokter hewan.`,
    })),
);

export function rulesForSymptom(symptom: SymptomCode) {
  return VETERINARY_RULES.filter((rule) => rule.symptom === symptom).map((rule) => ({
    ...rule,
    protocolName: protocolById(rule.protocolId).name,
  }));
}

export function labelDoseNote(species: LivestockSpecies, weightKg: number) {
  const weight = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(weightKg);
  return `Bobot tercatat ${weight} kg untuk ${species}. Takaran mengikuti label produk untuk spesies ini. Aplikasi tidak menghitung mg/kg antibiotik.`;
}
