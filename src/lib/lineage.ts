import {
  isLifeStage,
  STAGE_LABEL,
  type Animal,
  type FeedLog,
  type LifeStage,
  type LivestockBook,
  type WeightCheck,
} from "@/lib/livestock";

const STAGE_RANK: Record<LifeStage, number> = { pedet: 0, dewasa: 1, culling: 2 };

export interface ConversionRatio {
  earTag: string;
  feedKg: number;
  gainKg: number;
  ratio: number | null;
  detail: string;
}

/**
 * Feed conversion is kilograms of feed eaten divided by live-weight gain.
 * Two weighings are required. A flat or falling weight has no ratio.
 */
export function feedConversion(animal: Animal, weights: WeightCheck[], feeds: FeedLog[]): ConversionRatio {
  const checks = weights
    .filter((item) => item.earTag === animal.earTag)
    .sort((left, right) => left.weighedOn.localeCompare(right.weighedOn));
  const first = checks[0];
  const last = checks[checks.length - 1];
  if (!first || !last || first.id === last.id) {
    return { earTag: animal.earTag, feedKg: 0, gainKg: 0, ratio: null, detail: "Perlu dua catatan bobot." };
  }
  const gainKg = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  const feedKg = Math.round(
    feeds
      .filter((item) => item.earTag === animal.earTag && item.fedOn >= first.weighedOn && item.fedOn <= last.weighedOn)
      .reduce((sum, item) => sum + item.feedKg, 0) * 10,
  ) / 10;
  if (gainKg <= 0) {
    return { earTag: animal.earTag, feedKg, gainKg, ratio: null, detail: "Bobot tidak naik, FCR tidak dihitung." };
  }
  const ratio = Math.round((feedKg / gainKg) * 100) / 100;
  return {
    earTag: animal.earTag,
    feedKg,
    gainKg,
    ratio,
    detail: `${feedKg} kg pakan / ${gainKg} kg naik = ${ratio}`,
  };
}

export function setLineage(
  book: LivestockBook,
  animalId: string,
  input: { stage: LifeStage; sireTag: string; damTag: string },
): { ok: true; book: LivestockBook } | { ok: false; message: string } {
  const current = book.animals.find((item) => item.id === animalId);
  if (!current) return { ok: false, message: "Ternak tidak ditemukan." };
  if (!isLifeStage(input.stage)) return { ok: false, message: "Tahap hidup tidak dikenal." };
  if (STAGE_RANK[input.stage] < STAGE_RANK[current.stage]) {
    return { ok: false, message: `${STAGE_LABEL[current.stage]} tidak kembali ke ${STAGE_LABEL[input.stage]}.` };
  }
  const sireTag = input.sireTag.trim().toUpperCase();
  const damTag = input.damTag.trim().toUpperCase();
  if (sireTag && !book.animals.some((item) => item.earTag === sireTag && item.species === current.species && item.id !== current.id)) {
    return { ok: false, message: "Pejantan harus ternak lain dengan jenis yang sama." };
  }
  if (damTag && !book.animals.some((item) => item.earTag === damTag && item.species === current.species && item.id !== current.id)) {
    return { ok: false, message: "Induk harus ternak lain dengan jenis yang sama." };
  }
  if (sireTag && sireTag === damTag) return { ok: false, message: "Pejantan dan induk harus berbeda." };
  const animals = book.animals.map((item) =>
    item.id === current.id ? { ...item, stage: input.stage, sireTag: sireTag || null, damTag: damTag || null } : item,
  );
  return { ok: true, book: { ...book, animals } };
}

export function recordWeight(book: LivestockBook, earTag: string, weighedOn: string, weightKg: number, id: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weighedOn)) return { ok: false as const, message: "Tanggal timbang tidak valid." };
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 1500) {
    return { ok: false as const, message: "Bobot harus di atas 0 dan paling besar 1.500 kg." };
  }
  const animal = book.animals.find((item) => item.earTag === earTag);
  if (!animal) return { ok: false as const, message: "Ternak tidak ditemukan." };
  const row: WeightCheck = { id, earTag, weighedOn, weightKg: Math.round(weightKg * 10) / 10 };
  const animals = book.animals.map((item) => (item.id === animal.id ? { ...item, weightKg: row.weightKg } : item));
  return { ok: true as const, book: { ...book, animals, weightChecks: [row, ...(book.weightChecks ?? [])] } };
}

export function recordFeed(book: LivestockBook, earTag: string, fedOn: string, feedKg: number, id: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fedOn)) return { ok: false as const, message: "Tanggal pakan tidak valid." };
  if (!Number.isFinite(feedKg) || feedKg <= 0 || feedKg > 500) {
    return { ok: false as const, message: "Pakan harus di atas 0 dan paling besar 500 kg." };
  }
  if (!book.animals.some((item) => item.earTag === earTag)) return { ok: false as const, message: "Ternak tidak ditemukan." };
  const row: FeedLog = { id, earTag, fedOn, feedKg: Math.round(feedKg * 10) / 10 };
  return { ok: true as const, book: { ...book, feedLogs: [row, ...(book.feedLogs ?? [])] } };
}
