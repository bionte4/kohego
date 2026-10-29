import { availableWasteKg, manureProjection, liveWeightKg, SPECIES_LABEL, SPECIES_ORDER, type LivestockBook } from "@/lib/livestock";
import { historyStatusLabel, type PublisherBook } from "@/lib/publisher";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SpeciesPopulation {
  species: (typeof SPECIES_ORDER)[number];
  label: string;
  heads: number;
  quarantine: number;
  sick: number;
  watch: number;
  avgKg: number;
  liveKg: number;
}

/** Active heads exclude animals already marked sold. Averages use per-head weight, not lot mass. */
export function herdPopulation(book: LivestockBook): SpeciesPopulation[] {
  return SPECIES_ORDER.map((species) => {
    const animals = book.animals.filter((animal) => animal.species === species && animal.health !== "terjual");
    const heads = animals.reduce((sum, animal) => sum + animal.headcount, 0);
    const liveKg = animals.reduce((sum, animal) => sum + liveWeightKg(animal), 0);
    return {
      species,
      label: SPECIES_LABEL[species],
      heads,
      quarantine: animals.filter((animal) => animal.health === "karantina").reduce((sum, animal) => sum + animal.headcount, 0),
      sick: animals.filter((animal) => animal.health === "sakit").reduce((sum, animal) => sum + animal.headcount, 0),
      watch: animals.filter((animal) => animal.health === "pantau").reduce((sum, animal) => sum + animal.headcount, 0),
      avgKg: heads === 0 ? 0 : liveKg / heads,
      liveKg,
    };
  });
}

/**
 * Intake uses the collection timestamp. Today is the local calendar day.
 * The week is that day plus the six days before it, so a Monday morning still
 * includes the previous Tuesday.
 */
export function wasteIntake(book: LivestockBook, now: Date) {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const weekStart = startToday.getTime() - 6 * DAY_MS;
  let todayKg = 0;
  let weekKg = 0;
  for (const row of book.waste) {
    const time = new Date(row.collectedAt).getTime();
    if (Number.isNaN(time) || time < weekStart) continue;
    weekKg += row.massKg;
    if (time >= startToday.getTime()) todayKg += row.massKg;
  }
  const projection = manureProjection(book.animals);
  return {
    todayKg,
    weekKg,
    availableKg: availableWasteKg(book.waste),
    expectedDailyKg: projection.includedKg,
    withheldDailyKg: projection.withheldKg,
    withheldHeads: projection.withheldHeads,
  };
}

export function weightLeaders(book: LivestockBook) {
  return book.animals
    .filter((animal) => animal.health !== "terjual")
    .slice()
    .sort((a, b) => liveWeightKg(b) - liveWeightKg(a))
    .slice(0, 4)
    .map((animal) => ({
      id: animal.id,
      earTag: animal.earTag,
      label: `${SPECIES_LABEL[animal.species]} ${animal.breed}`,
      kg: animal.weightKg,
      heads: animal.headcount,
      liveKg: liveWeightKg(animal),
    }));
}

export function publisherPulse(book: PublisherBook) {
  let menunggu = 0;
  let terbit = 0;
  let gagal = 0;
  for (const post of book.posts) {
    if (post.targets.length === 0) {
      if (post.queue === "terjadwal") menunggu += post.platforms.length;
      continue;
    }
    for (const target of post.targets) {
      const label = historyStatusLabel(target.status);
      if (label === "Menunggu") menunggu += 1;
      else if (label === "Terbit") terbit += 1;
      else if (label === "Gagal") gagal += 1;
    }
  }
  return { menunggu, terbit, gagal, posts: book.posts.length };
}
