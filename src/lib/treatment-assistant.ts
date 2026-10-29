import { SYMPTOM_LABEL, TEMP_BAND, type HealthCheckStatus, type SymptomCode } from "@/lib/health";
import type { LivestockSpecies } from "@/lib/livestock";
import { recommendTreatment, type TreatmentProtocol, type TreatmentRecommendation } from "@/lib/treatment-protocols";

export interface AssistantAdvice {
  /** Expert rules over the protocol catalog. This is not a veterinary prescription. */
  source: "aturan-kandang";
  narrative: string;
  isolation: string;
  steps: string[];
  medicines: TreatmentRecommendation["medicines"];
  vitamins: TreatmentRecommendation["medicines"];
  plan: TreatmentRecommendation;
}

/**
 * Turns a health log into one protocol.
 * Temperature and activity adjust the explanation. The chosen actions still come
 * from the expert protocol list, not from an open-ended model.
 */
export function assistTreatment(
  input: {
    species: LivestockSpecies;
    status: HealthCheckStatus;
    symptoms: SymptomCode[];
    temperatureC: number | null;
    activityLevel: number | null;
  },
  protocols?: TreatmentProtocol[],
): AssistantAdvice {
  const plan = recommendTreatment(
    { species: input.species, status: input.status, symptoms: input.symptoms },
    protocols,
  );
  const narrative = [vitalSentence(input), symptomSentence(input.symptoms), `Asisten memilih protokol ${plan.protocol.name}. ${plan.protocol.summary}`]
    .filter(Boolean)
    .join(" ");
  return {
    source: "aturan-kandang",
    narrative,
    isolation: plan.protocol.isolation,
    steps: plan.protocol.steps,
    medicines: plan.medicines.filter((medicine) => medicine.id !== "vitamin-b"),
    vitamins: plan.medicines.filter((medicine) => medicine.id === "vitamin-b"),
    plan,
  };
}

function vitalSentence(input: { species: LivestockSpecies; temperatureC: number | null; activityLevel: number | null }) {
  if (input.temperatureC === null || input.activityLevel === null) return "Tanda vital belum dicatat.";
  const band = TEMP_BAND[input.species];
  const outside = input.temperatureC < band.min || input.temperatureC > band.max;
  const place = outside ? "di luar" : "di dalam";
  return `Suhu ${input.temperatureC.toFixed(1)}°C (${place} rentang ${band.min.toFixed(1)}–${band.max.toFixed(1)}°C) dan aktivitas ${input.activityLevel} dari 100.`;
}

function symptomSentence(symptoms: SymptomCode[]) {
  if (symptoms.length === 0) return "Tidak ada gejala visual yang dicatat.";
  return `Gejala: ${symptoms.map((code) => SYMPTOM_LABEL[code]).join(", ")}.`;
}
