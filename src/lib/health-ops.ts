import { latestHealthLog } from "@/lib/health";
import { SPECIES_LABEL, type Animal, type HealthStatus, type LivestockBook } from "@/lib/livestock";

/**
 * Scores below this are HIGH or CRITICAL in the health simulator.
 * The farm manager is alerted when a check falls under the line, or when the
 * herd status is already sakit or karantina.
 */
export const RISK_ALERT_SCORE = 70;

export interface HealthAlert {
  id: string;
  earTag: string;
  label: string;
  health: HealthStatus;
  score: number | null;
  reason: string;
  href: string;
}

/** Animals whose manure must stay out of the composting projection. */
export function healthHoldsManure(health: HealthStatus) {
  return health === "sakit" || health === "karantina";
}

/**
 * Dashboard alerts for the farm manager. Derived from the herd book on each
 * read, so a status change in the health module shows up without a second write.
 */
export function healthAnomalies(book: LivestockBook): HealthAlert[] {
  return book.animals
    .filter((animal) => animal.health !== "terjual")
    .flatMap((animal) => {
      const log = latestHealthLog(book.healthLogs ?? [], animal.earTag);
      const lowScore = log !== null && log.score < RISK_ALERT_SCORE;
      if (!healthHoldsManure(animal.health) && !lowScore) return [];
      return [toAlert(animal, log?.score ?? null, lowScore)];
    })
    .sort((left, right) => rank(left.health) - rank(right.health) || (left.score ?? 0) - (right.score ?? 0));
}

function toAlert(animal: Animal, score: number | null, lowScore: boolean): HealthAlert {
  const status = animal.health === "sakit" ? "Sakit" : animal.health === "karantina" ? "Karantina" : "Pantau";
  const reason = lowScore && score !== null
    ? `${status}. Skor ${score} berada di bawah ambang ${RISK_ALERT_SCORE}.`
    : `${status}. Kohe ternak ini tidak masuk perkiraan harian.`;
  return {
    id: animal.id,
    earTag: animal.earTag,
    label: SPECIES_LABEL[animal.species],
    health: animal.health,
    score,
    reason,
    href: `/livestock/health/${animal.id}`,
  };
}

function rank(health: HealthStatus) {
  if (health === "sakit") return 0;
  if (health === "karantina") return 1;
  return 2;
}
