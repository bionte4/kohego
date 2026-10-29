import { isSymptom, recordHealthCheck, type SymptomCode } from "@/lib/health";
import { recordFeed } from "@/lib/lineage";
import { recordWaste, type LivestockBook } from "@/lib/livestock";

export interface InspectionAnimal {
  earTag: string;
  temperatureC: number | null;
  activityLevel: number | null;
  symptoms: SymptomCode[];
  feedKg: number | null;
  manureKg: number | null;
}

/** One keeper round for a pen: water, floor, feed, and any animal numbers filled in. */
export interface DailyInspection {
  id: string;
  penId: string;
  inspectedOn: string;
  waterOk: boolean;
  floorDry: boolean;
  feedFresh: boolean;
  note: string;
  recordedBy: string;
  animals: InspectionAnimal[];
}

export interface InspectionRowDraft {
  animalId: string;
  temperatureC: string;
  activityLevel: string;
  symptoms: SymptomCode[];
  feedKg: string;
  manureKg: string;
}

export interface InspectionDraft {
  penId: string;
  inspectedOn: string;
  waterOk: boolean;
  floorDry: boolean;
  feedFresh: boolean;
  note: string;
  recordedBy: string;
  rows: InspectionRowDraft[];
}

function parseAmount(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export function parseInspections(input: unknown): DailyInspection[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<DailyInspection>;
    if (typeof row.id !== "string" || typeof row.penId !== "string" || typeof row.inspectedOn !== "string") return [];
    const animals = Array.isArray(row.animals)
      ? row.animals.flatMap((animal) => {
          if (!animal || typeof animal !== "object") return [];
          const entry = animal as Partial<InspectionAnimal>;
          if (typeof entry.earTag !== "string") return [];
          const symptoms = Array.isArray(entry.symptoms) ? entry.symptoms.filter(isSymptom) : [];
          return [{
            earTag: entry.earTag,
            temperatureC: typeof entry.temperatureC === "number" ? entry.temperatureC : null,
            activityLevel: typeof entry.activityLevel === "number" ? entry.activityLevel : null,
            symptoms,
            feedKg: typeof entry.feedKg === "number" ? entry.feedKg : null,
            manureKg: typeof entry.manureKg === "number" ? entry.manureKg : null,
          }];
        })
      : [];
    return [{
      id: row.id,
      penId: row.penId,
      inspectedOn: row.inspectedOn,
      waterOk: row.waterOk === true,
      floorDry: row.floorDry === true,
      feedFresh: row.feedFresh === true,
      note: typeof row.note === "string" ? row.note.slice(0, 280) : "",
      recordedBy: typeof row.recordedBy === "string" ? row.recordedBy : "",
      animals,
    }];
  });
}

/**
 * Saves the pen checklist, then any temperature, feed, and manure the keeper filled in.
 * Manure from an animal still inside a withdrawal window is rejected with the lock message.
 */
export function saveDailyInspection(
  book: LivestockBook,
  draft: InspectionDraft,
  id: string,
  nowIso: string,
  ids: { health: (earTag: string) => string; feed: (earTag: string) => string; waste: (earTag: string) => string },
): { ok: true; book: LivestockBook } | { ok: false; message: string } {
  const pen = book.pens.find((item) => item.id === draft.penId);
  if (!pen) return { ok: false, message: "Pilih kandang yang diperiksa." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.inspectedOn)) return { ok: false, message: "Tanggal inspeksi tidak valid." };

  let next = book;
  const animals: InspectionAnimal[] = [];
  for (const row of draft.rows) {
    const animal = next.animals.find((item) => item.id === row.animalId && item.penId === pen.id && item.health !== "terjual");
    if (!animal) return { ok: false, message: "Ada ternak yang tidak lagi di kandang ini." };
    const temperature = parseAmount(row.temperatureC);
    const feed = parseAmount(row.feedKg);
    const manure = parseAmount(row.manureKg);
    if (Number.isNaN(temperature) || Number.isNaN(feed) || Number.isNaN(manure)) {
      return { ok: false, message: `Angka pada ${animal.earTag} tidak valid.` };
    }
    const activityLevel = row.activityLevel.trim() ? Number(row.activityLevel) : 70;
    let temperatureC: number | null = null;
    let storedActivity: number | null = null;
    if (temperature !== null) {
      const checked = recordHealthCheck(
        next,
        animal.id,
        { temperatureC: temperature, activityLevel, symptoms: row.symptoms },
        ids.health(animal.earTag),
        nowIso,
        draft.recordedBy || null,
      );
      if (!checked.ok) return checked;
      next = checked.book;
      temperatureC = checked.log.temperatureC;
      storedActivity = checked.log.activityLevel;
    }
    let feedKg: number | null = null;
    if (feed !== null) {
      const logged = recordFeed(next, animal.earTag, draft.inspectedOn, feed, ids.feed(animal.earTag));
      if (!logged.ok) return logged;
      next = logged.book;
      feedKg = feed;
    }
    let manureKg: number | null = null;
    if (manure !== null) {
      const collected = recordWaste(next, { animalId: animal.id, massKg: manure, note: "Inspeksi harian" }, ids.waste(animal.earTag), nowIso);
      if (!collected.ok) return collected;
      next = collected.book;
      manureKg = manure;
    }
    animals.push({
      earTag: animal.earTag,
      temperatureC,
      activityLevel: storedActivity,
      symptoms: row.symptoms,
      feedKg,
      manureKg,
    });
  }

  const inspection: DailyInspection = {
    id,
    penId: pen.id,
    inspectedOn: draft.inspectedOn,
    waterOk: draft.waterOk,
    floorDry: draft.floorDry,
    feedFresh: draft.feedFresh,
    note: draft.note.trim().slice(0, 280),
    recordedBy: draft.recordedBy,
    animals,
  };
  return { ok: true, book: { ...next, inspections: [inspection, ...(next.inspections ?? [])] } };
}
