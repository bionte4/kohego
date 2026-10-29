import { COMPOST_STANDARD } from "@/lib/compost";
import { isIcarRfid } from "@/lib/identification";
import type { Animal, HealthStatus, LivestockBook, Pen } from "@/lib/livestock";
import { PHARMACOLOGY_STANDARDS, standardFor } from "@/lib/pharmacology-standards";
import { activeHolds } from "@/lib/withdrawal";

const LOCKED_HEALTH: HealthStatus[] = ["sakit", "karantina"];

export interface ComplianceHold {
  earTag: string;
  penName: string;
  medicineName: string;
  until: string;
  residueNote: string;
}

export interface ComplianceZone {
  penName: string;
  location: string;
  animals: Animal[];
}

export interface ComplianceSnapshot {
  zones: ComplianceZone[];
  holds: ComplianceHold[];
  registeredRfid: number;
  missingRfid: Animal[];
  compost: typeof COMPOST_STANDARD;
  standards: typeof PHARMACOLOGY_STANDARDS;
}

function penOf(pens: Pen[], penId: string) {
  return pens.find((pen) => pen.id === penId);
}

/** Biosecurity snapshot from the herd book. Residue numbers stay on the product label. */
export function complianceSnapshot(book: LivestockBook, nowIso: string): ComplianceSnapshot {
  const live = book.animals.filter((animal) => animal.health !== "terjual");
  const zones = book.pens.flatMap((pen) => {
    const animals = live.filter((animal) => animal.penId === pen.id && LOCKED_HEALTH.includes(animal.health));
    if (animals.length === 0) return [];
    return [{ penName: pen.name, location: pen.location, animals }];
  });
  const holds = live.flatMap((animal) => {
    const doses = (book.treatmentCases ?? []).filter((item) => item.earTag === animal.earTag).flatMap((item) => item.doses);
    const pen = penOf(book.pens, animal.penId);
    return activeHolds(doses, nowIso).map((hold) => ({
      earTag: animal.earTag,
      penName: pen?.name ?? animal.penId,
      medicineName: hold.medicineName,
      until: hold.until,
      residueNote: standardFor(hold.medicineName)?.residueNote ?? PHARMACOLOGY_STANDARDS[0].residueNote,
    }));
  });
  return {
    zones,
    holds,
    registeredRfid: live.filter((animal) => isIcarRfid(animal.rfid)).length,
    missingRfid: live.filter((animal) => !isIcarRfid(animal.rfid)),
    compost: COMPOST_STANDARD,
    standards: PHARMACOLOGY_STANDARDS,
  };
}
